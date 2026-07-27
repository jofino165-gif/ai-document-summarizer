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
FALLBACK_SUMMARIZER_MODEL = os.environ.get(
    "FALLBACK_SUMMARIZER_MODEL",
    "facebook/bart-large-cnn"
)

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
    import pytesseract
    from PIL import Image

    try:
        image = Image.open(io.BytesIO(raw_bytes))

        # Convert image to improve OCR accuracy
        image = image.convert("L")

        text = pytesseract.image_to_string(image)

        print("OCR OUTPUT:")
        print(text)

        return text.strip()

    except Exception as e:
        print("OCR ERROR:", e)
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
            _summarizer_pipeline = pipeline(
                "summarization",
                model=SUMMARIZER_MODEL_PATH
            )
            MODEL_STATUS["summarizer"] = f"Loaded ({SUMMARIZER_MODEL_PATH})"

        else:
            _summarizer_pipeline = pipeline(
                "summarization",
                model=FALLBACK_SUMMARIZER_MODEL
            )
            MODEL_STATUS["summarizer"] = (
                f"Loaded ({FALLBACK_SUMMARIZER_MODEL} fallback)"
            )

    except Exception as exc:
        _summarizer_pipeline = False
        MODEL_STATUS["summarizer"] = f"Fallback (heuristic) - {exc}"

    return _summarizer_pipeline



def summarize_text(text, max_length=120, min_length=40):

    text = (text or "").strip()

    if not text:
        return ""


    summarizer = _load_summarizer()


    if summarizer:

        try:

            # Split large documents into smaller chunks
            sentences = re.split(
                r"(?<=[.!?])\s+",
                text
            )


            chunks = []
            current_chunk = ""


            for sentence in sentences:

                if len(current_chunk) + len(sentence) < 3500:

                    current_chunk += " " + sentence

                else:

                    if current_chunk:
                        chunks.append(current_chunk)

                    current_chunk = sentence


            if current_chunk:
                chunks.append(current_chunk)



            summaries = []


            # Generate summary for each chunk
            for chunk in chunks:

                result = summarizer(
                    chunk,
                    max_length=max_length,
                    min_length=min_length,
                    do_sample=False,
                    num_beams=4,
                    length_penalty=2.0
                )


                summaries.append(
                    result[0]["summary_text"].strip()
                )



            # Combine all chunk summaries
            final_summary = " ".join(summaries)


            return final_summary.strip()



        except Exception as e:

            print("Summarizer error:", e)



    # If model fails use simple extraction
    return _heuristic_summary(
        text,
        sentence_count=5
    )



def _heuristic_summary(text, sentence_count=5):

    sentences = re.split(
        r"(?<=[.!?])\s+",
        text.strip()
    )

    sentences = [
        s for s in sentences if s
    ]


    return (
        " ".join(sentences[:sentence_count])
        if sentences
        else text[:300]
    )
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

    "study_important":
    "Important study document detected. Focus on key definitions, formulas, and important topics for revision.",

    "health_risk":
    "Health information detected. Review symptoms, test results, and detected diseases carefully. Consult a healthcare professional for proper diagnosis.",

    "news_alert":
    "News content detected. Verify information from trusted sources before making decisions.",

    "legal_expiry":
    "Legal document detected. Check important dates, expiry periods, clauses, and obligations carefully."
}


def get_recommendation(category, text="", prediction=""):

    text = text.lower()

    # ---------------- HEALTH ----------------
    if category == "health_risk":

        if "Diabetes" in prediction:
            return "Detected Diabetes. Reduce sugar intake, exercise regularly, and consult a diabetologist."

        elif "Hypertension" in prediction:
            return "Detected Hypertension. Reduce salt intake, monitor blood pressure regularly, and consult a physician."

        elif "Covid" in prediction:
            return "Detected COVID-19. Isolate if necessary, stay hydrated, and follow your doctor's advice."

        elif "Dengue" in prediction:
            return "Detected Dengue. Drink plenty of fluids, monitor platelet count, and consult a doctor immediately."

        elif "Malaria" in prediction:
            return "Detected Malaria. Complete the prescribed medication and seek medical care."

        elif "Asthma" in prediction:
            return "Detected Asthma. Avoid dust and smoke, carry your inhaler, and consult your doctor."

        elif "Cancer" in prediction:
            return "Detected Cancer. Consult an oncologist immediately for further diagnosis and treatment."

        else:
            return _RECOMMENDATIONS["health_risk"]

    # ---------------- NEWS ----------------
    elif category == "news_alert":

        if "petrol" in text or "fuel" in text:
            return "Petrol prices may increase. Save fuel and plan your travel wisely."

        elif "gas" in text:
            return "Gas shortage detected. Use gas carefully and avoid unnecessary wastage."

        elif "water" in text:
            return "Water shortage reported. Conserve water whenever possible."

        elif "rain" in text:
            return "Heavy rain expected. Carry an umbrella and avoid flooded areas."

        elif "electricity" in text or "power" in text:
            return "Power shortage reported. Save electricity whenever possible."

        elif "stock" in text:
            return "Stock market news detected. Invest carefully after proper research."

        else:
            return _RECOMMENDATIONS["news_alert"]

    # ---------------- LEGAL ----------------
    elif category == "legal_expiry":

        if "expired" in text:
            return "This legal document has already expired. Renew it immediately."

        elif "expires on" in text or "valid until" in text:
            return "This legal document is active. Renew it before the expiry date."

        elif "agreement" in text:
            return "Review all agreement clauses carefully before signing."

        elif "license" in text:
            return "Renew the license before it expires to avoid legal issues."

        else:
            return _RECOMMENDATIONS["legal_expiry"]

    # ---------------- STUDY ----------------
    elif category == "study_important":

        important = []

        keywords = [
            "definition",
            "formula",
            "algorithm",
            "classification",
            "types",
            "advantages",
            "disadvantages",
            "architecture",
            "protocol",
            "example"
        ]

        for word in keywords:
            if word in text:
                important.append(word.title())

        if important:
            return "Important Topics to Study: " + ", ".join(important)

        return _RECOMMENDATIONS["study_important"]

    return "Review this document at your convenience."

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

def predict_document(category, text):
    text = text.lower()

    # Legal
    if category == "legal_expiry":

        if "expired" in text or "expiry date passed" in text:
            return "Status: Document Expired"

        elif "valid until" in text or "expires on" in text:
            return "Status: Document Active"

        else:
            return "Status: Expiry Not Found"

    # Health
    elif category == "health_risk":

        diseases = {
            "diabetes": [
                "diabetes",
                "glucose",
                "blood sugar",
                "high sugar",
                "type 2"
            ],

            "hypertension": [
                "hypertension",
                "high blood pressure",
                "bp",
                "blood pressure"
            ],

            "covid": [
                "covid",
                "coronavirus",
                "sars-cov-2"
            ],

            "dengue": [
                "dengue",
                "platelet",
                "mosquito"
            ],

            "malaria": [
                "malaria",
                "parasite",
                "fever chills"
            ],

            "asthma": [
                "asthma",
                "breathing problem",
                "wheezing"
            ],

            "cancer": [
                "cancer",
                "tumor",
                "oncology"
            ]
        }


        detected = []

        for disease, keywords in diseases.items():

            for word in keywords:

                if word in text:
                    detected.append(disease)
                    break


        if detected:
            return "Detected Disease: " + ", ".join(
                [d.title() for d in detected]
            )

        return "No disease detected"

    # Study
    elif category == "study_important":

        keywords = [
            "definition",
            "formula",
            "algorithm",
            "advantage",
            "disadvantage",
            "classification",
            "types"
        ]

        found = []

        for word in keywords:
            if word in text:
                found.append(word.title())

        if found:
            return "Important Topics: " + ", ".join(found)

        return "No important topics found"

    # News
    elif category == "news_alert":

        if "petrol" in text or "fuel" in text:
            return "Petrol demand is increasing. Save fuel and expect price changes."

        if "rain" in text:
            return "Heavy rain expected. Stay alert."

        if "stock" in text:
            return "Stock market news detected."

        return "General News"

    return "Prediction unavailable"