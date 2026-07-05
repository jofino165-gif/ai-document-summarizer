"""
AI pipeline for the summarizer backend.

Everything in here is lazy-loaded and globally cached, so the first request
that needs a given model pays the load cost and every request after that
reuses the same in-memory pipeline. If `transformers`/`torch` aren't
installed, or a model fails to download/load, each function falls back to a
cheap non-ML heuristic so the API keeps working end-to-end.

MODEL_STATUS is read by GET /api/admin/model-status.
"""
import io
import os
import re

# ── Model status registry (surfaced at /api/admin/model-status) ─────────────
MODEL_STATUS = {
    "summarizer": "Loaded",
    "detector": "Loaded",
    "qa_model": "Using Summarizer Model"
}

# ── Config (override via environment variables) ─────────────────────────────
SUMMARIZER_MODEL_PATH = os.environ.get("SUMMARIZER_MODEL_PATH", "trained_model")
CLASSIFIER_MODEL_PATH = os.environ.get("CLASSIFIER_MODEL_PATH", "model/detection_model")
QA_MODEL_NAME = os.environ.get("QA_MODEL_NAME", "deepset/roberta-base-squad2")
FALLBACK_SUMMARIZER_MODEL = os.environ.get("FALLBACK_SUMMARIZER_MODEL", "t5-small")

CATEGORY_KEYS = ["study_important", "health_risk", "news_alert", "legal_expiry"]

# ── Cached pipeline handles ──────────────────────────────────────────────────
_summarizer_pipeline = None
_classifier_pipeline = None
_qa_pipeline = None


# =============================================================================
# Text extraction
# =============================================================================
def extract_text(file_storage):
    """
    Pull plain text out of an uploaded werkzeug FileStorage object based on
    its extension. Returns (text, error). On unsupported/unreadable files,
    text is "" and error explains why.
    """
    filename = file_storage.filename or ""
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    raw = file_storage.read()
    file_storage.stream.seek(0)

    try:
        if ext == "txt":
            return raw.decode("utf-8", errors="ignore"), None

        if ext == "pdf":
            return _extract_pdf_text(raw), None

        if ext == "docx":
            return _extract_docx_text(raw), None

        if ext in ("jpg", "jpeg", "png", "gif", "webp"):
            return _extract_image_text(raw), None

        # Unknown extension: best-effort decode as text.
        return raw.decode("utf-8", errors="ignore"), None
    except Exception as exc:  # noqa: BLE001 - want to report any parse failure
        return "", f"Could not extract text from .{ext or '?'} file: {exc}"


def _extract_pdf_text(raw_bytes):
    from pypdf import PdfReader

    reader = PdfReader(io.BytesIO(raw_bytes))
    pages = [page.extract_text() or "" for page in reader.pages]
    return "\n".join(pages).strip()


def _extract_docx_text(raw_bytes):
    import docx  # python-docx

    document = docx.Document(io.BytesIO(raw_bytes))
    return "\n".join(p.text for p in document.paragraphs).strip()


def _extract_image_text(raw_bytes):
    """OCR via pytesseract if available, otherwise a clear placeholder."""
    try:
        import pytesseract
        from PIL import Image

        image = Image.open(io.BytesIO(raw_bytes))
        text = pytesseract.image_to_string(image)
        return text.strip()
    except Exception:
        return ""


# =============================================================================
# Summarization
# =============================================================================
def _load_summarizer():
    global _summarizer_pipeline
    if _summarizer_pipeline is not None:
        return _summarizer_pipeline

    try:
        from transformers import pipeline

        if os.path.isdir(SUMMARIZER_MODEL_PATH):
            _summarizer_pipeline = pipeline("summarization", model=SUMMARIZER_MODEL_PATH)
            MODEL_STATUS["summarizer"] = f"Loaded ({SUMMARIZER_MODEL_PATH})"
        else:
            _summarizer_pipeline = pipeline("summarization", model=FALLBACK_SUMMARIZER_MODEL)
            MODEL_STATUS["summarizer"] = f"Loaded ({FALLBACK_SUMMARIZER_MODEL} fallback)"
    except Exception as exc:  # noqa: BLE001
        _summarizer_pipeline = False  # sentinel: tried and failed
        MODEL_STATUS["summarizer"] = f"Fallback (heuristic) - {exc}"

    return _summarizer_pipeline


def summarize_text(text, max_length=150, min_length=30):
    text = (text or "").strip()
    if not text:
        return ""

    summarizer = _load_summarizer()
    if summarizer:
        try:
            # T5-family models have small context windows; truncate defensively.
            chunk = text[:4000]
            result = summarizer(
                chunk, max_length=max_length, min_length=min_length, do_sample=False
            )
            return result[0]["summary_text"].strip()
        except Exception:
            pass  # fall through to heuristic

    return _heuristic_summary(text, sentence_count=3)


def _heuristic_summary(text, sentence_count=3):
    """Naive fallback: first N sentences. Used if transformers is unavailable."""
    sentences = re.split(r"(?<=[.!?])\s+", text.strip())
    sentences = [s for s in sentences if s]
    return " ".join(sentences[:sentence_count]) if sentences else text[:300]


# =============================================================================
# Category classification
# =============================================================================
_KEYWORD_RULES = {
    "legal_expiry": [
        "contract", "agreement", "clause", "terminate", "termination",
        "expiration", "expiry", "legal", "lawsuit", "plaintiff", "defendant",
        "shall", "hereby", "jurisdiction", "statute",
    ],
    "health_risk": [
        "diagnosis", "patient", "treatment", "symptom", "medication",
        "doctor", "hospital", "disease", "health", "prescription",
        "dosage", "medical", "clinical",
    ],
    "news_alert": [
        "breaking", "reported", "according to", "officials", "announced",
        "news", "today", "yesterday", "government", "press release",
    ],
    "study_important": [
        "chapter", "lecture", "exam", "homework", "assignment", "syllabus",
        "study", "research", "university", "professor", "course",
    ],
}


def _load_classifier():
    global _classifier_pipeline
    if _classifier_pipeline is not None:
        return _classifier_pipeline

    try:
        from transformers import pipeline

        if os.path.isdir(CLASSIFIER_MODEL_PATH):
            _classifier_pipeline = pipeline(
                "text-classification", model=CLASSIFIER_MODEL_PATH
            )
            MODEL_STATUS["detector"] = f"Loaded ({CLASSIFIER_MODEL_PATH})"
        else:
            _classifier_pipeline = False
            MODEL_STATUS["detector"] = "Fallback (keyword rules) - no fine-tuned model found"
    except Exception as exc:  # noqa: BLE001
        _classifier_pipeline = False
        MODEL_STATUS["detector"] = f"Fallback (keyword rules) - {exc}"

    return _classifier_pipeline


def classify_category(text):
    """Returns one of CATEGORY_KEYS."""
    classifier = _load_classifier()
    if classifier:
        try:
            result = classifier(text[:2000])[0]
            label = result.get("label", "").lower()
            if label in CATEGORY_KEYS:
                return label
        except Exception:
            pass  # fall through to keyword rules

    return _keyword_classify(text)


def _keyword_classify(text):
    lowered = (text or "").lower()
    scores = {key: 0 for key in CATEGORY_KEYS}
    for category, keywords in _KEYWORD_RULES.items():
        for kw in keywords:
            if kw in lowered:
                scores[category] += 1

    best_category = max(scores, key=scores.get)
    if scores[best_category] == 0:
        return "study_important"  # neutral default
    return best_category


# =============================================================================
# Recommendation (rule-based, keyed off category)
# =============================================================================
_RECOMMENDATIONS = {
    "study_important": "This looks like study material — consider adding it to your revision notes and reviewing it before exams.",
    "health_risk": "This document references health-related information. Please consult a medical professional before acting on it.",
    "news_alert": "This looks like a news item. Cross-check with another source before treating it as fully verified.",
    "legal_expiry": "This document may contain binding terms or deadlines. Review key dates and consider legal advice if unsure.",
}


def get_recommendation(category):
    return _RECOMMENDATIONS.get(category, "Review this document at your convenience.")


# =============================================================================
# Question answering
# =============================================================================
def _load_qa():
    global _qa_pipeline
    if _qa_pipeline is not None:
        return _qa_pipeline

    try:
        from transformers import pipeline

        _qa_pipeline = pipeline("question-answering", model=QA_MODEL_NAME)
        MODEL_STATUS["qa_model"] = f"Loaded ({QA_MODEL_NAME})"
    except Exception as exc:  # noqa: BLE001
        _qa_pipeline = False
        MODEL_STATUS["qa_model"] = f"Fallback (unavailable) - {exc}"

    return _qa_pipeline


def answer_question(context, question):
    context = (context or "").strip()
    question = (question or "").strip()
    if not context:
        return "No document context is available to answer this question."
    if not question:
        return "Please provide a question."

    qa = _load_qa()
    if qa:
        try:
            result = qa(question=question, context=context[:4000])
            answer = (result.get("answer") or "").strip()
            if answer:
                return answer
        except Exception:
            pass  # fall through to heuristic

    return _heuristic_answer(context, question)


def _heuristic_answer(context, question):
    """Naive fallback: return the sentence with the most word overlap."""
    question_words = {w.lower() for w in re.findall(r"\w+", question) if len(w) > 3}
    sentences = re.split(r"(?<=[.!?])\s+", context)
    best_sentence, best_score = "", 0
    for sentence in sentences:
        words = {w.lower() for w in re.findall(r"\w+", sentence)}
        score = len(question_words & words)
        if score > best_score:
            best_sentence, best_score = sentence, score
    return best_sentence.strip() or "I couldn't find a confident answer in this document."