"""
AI Summarizer Backend
======================
Flask + SQLAlchemy + T5 (transformers) backend matching the React frontend's
expected endpoints: /api/login, /api/register, /api/summarize, /api/ask,
plus history, feedback, and admin endpoints.

Run:
    pip install flask flask-cors flask-sqlalchemy pymysql transformers torch sentencepiece bcrypt pyjwt --break-system-packages
    python backend.py

Environment variables (all optional, sensible defaults provided):
    DB_HOST, DB_USER, DB_PASSWORD, DB_NAME, DB_PORT   -> MySQL/RDS config
    SECRET_KEY                                        -> Flask/JWT secret
    T5_MODEL_NAME                                      -> default "t5-small"
    PORT                                                -> default 5000
"""

import os
import datetime
import traceback

from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
import bcrypt
import jwt

# ──────────────────────────────────────────────────────────────────────────
# PART 1: Flask app, DB config, T5 model loading
# ──────────────────────────────────────────────────────────────────────────

app = Flask(__name__)
CORS(app)

SECRET_KEY = os.environ.get("SECRET_KEY", "dev-secret-change-me")
app.config["SECRET_KEY"] = SECRET_KEY

DB_HOST = os.environ.get("DB_HOST")
DB_USER = os.environ.get("DB_USER")
DB_PASSWORD = os.environ.get("DB_PASSWORD")
DB_NAME = os.environ.get("DB_NAME", "ai_summarizer")
DB_PORT = os.environ.get("DB_PORT", "3306")

if DB_HOST and DB_USER and DB_PASSWORD:
    # AWS RDS MySQL
    app.config["SQLALCHEMY_DATABASE_URI"] = (
        f"mysql+pymysql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
    )
else:
    # Local fallback
    app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///local_dev.db"

app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
db = SQLAlchemy(app)


# ---- T5 model loading -------------------------------------------------
# Loaded lazily on first request so the server starts instantly and so
# import errors (e.g. missing torch) don't crash app boot before you've
# had a chance to read the error.

T5_MODEL_NAME = os.environ.get("T5_MODEL_NAME", "trained_model")
_tokenizer = None
_model = None
_device = "cpu"


def get_t5():
    """Lazily load and cache the T5 tokenizer/model."""
    global _tokenizer, _model, _device
    if _model is None:
        from transformers import T5Tokenizer, T5ForConditionalGeneration
        import torch

        _device = "cuda" if torch.cuda.is_available() else "cpu"
        print(f"[T5] Loading model '{T5_MODEL_NAME}' on {_device} ...")
        _tokenizer = T5Tokenizer.from_pretrained(T5_MODEL_NAME)
        _model = T5ForConditionalGeneration.from_pretrained(T5_MODEL_NAME).to(_device)
        print("[T5] Model loaded.")
    return _tokenizer, _model, _device


def t5_summarize(text, max_input_tokens=512, max_output_tokens=180, min_output_tokens=30):
    """Summarize text with T5. Chunks long input and stitches summaries together."""
    import torch

    tokenizer, model, device = get_t5()
    text = (text or "").strip()
    if not text:
        return "No text provided to summarize."

    # T5 has a small context window, so chunk long documents and
    # summarize each chunk, then summarize the summaries if needed.
    words = text.split()
    chunk_size = 380  # ~ safely under 512 tokens after the "summarize: " prefix
    chunks = [" ".join(words[i:i + chunk_size]) for i in range(0, len(words), chunk_size)] or [text]

    partial_summaries = []
    for chunk in chunks:
        input_text = "summarize: " + chunk
        inputs = tokenizer.encode(
            input_text, return_tensors="pt", max_length=max_input_tokens, truncation=True
        ).to(device)
        with torch.no_grad():
            output_ids = model.generate(
    inputs,
    max_new_tokens=max_output_tokens,
    min_length=min_output_tokens,
    num_beams=6,
    length_penalty=2.0,
    no_repeat_ngram_size=3,
    repetition_penalty=1.2,
    early_stopping=True,
            )
        partial_summaries.append(tokenizer.decode(output_ids[0], skip_special_tokens=True))

    combined = " ".join(partial_summaries)

    # If multiple chunks were summarized, do a second pass to compress further.
    if len(chunks) > 1:
        input_text = "summarize: " + combined
        inputs = tokenizer.encode(
            input_text, return_tensors="pt", max_length=max_input_tokens, truncation=True
        ).to(device)
        with torch.no_grad():
           output_ids = model.generate(
    inputs,
    max_new_tokens=max_output_tokens,
    min_length=min_output_tokens,
    num_beams=6,
    length_penalty=2.0,
    no_repeat_ngram_size=3,
    repetition_penalty=1.2,
    early_stopping=True,
)
        combined = tokenizer.decode(output_ids[0], skip_special_tokens=True)

    return combined


def t5_answer_question(question, context=""):
    """
    T5 is not a QA-tuned model out of the box, but we can prompt it in a
    QA-style format. If you have a context document, pass it in; otherwise
    this falls back to a generic completion.
    """
    tokenizer, model, device = get_t5()
    import torch

    question = (question or "").strip()
    if not question:
        return "Please provide a question."

    if context:
        input_text = f"question: {question}  context: {context}"
    else:
        input_text = f"question: {question}"

    inputs = tokenizer.encode(
        input_text, return_tensors="pt", max_length=512, truncation=True
    ).to(device)
    with torch.no_grad():
        output_ids = model.generate(
            inputs, max_length=150, num_beams=4, early_stopping=True
        )
    return tokenizer.decode(output_ids[0], skip_special_tokens=True)


# ---- Database Models ---------------------------------------------------

class User(db.Model):
    __tablename__ = "users"
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(180), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(20), default="user")
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)

    def check_password(self, password):
        return bcrypt.checkpw(password.encode("utf-8"), self.password_hash.encode("utf-8"))

    def to_dict(self):
        return {"id": self.id, "name": self.name, "email": self.email, "role": self.role}


class HistoryItem(db.Model):
    __tablename__ = "history"
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    type = db.Column(db.String(80))
    file_name = db.Column(db.String(255))
    summary = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)

    def to_dict(self):
        return {
            "type": self.type,
            "file": self.file_name,
            "summary": self.summary,
            "date": self.created_at.strftime("%Y-%m-%d %H:%M:%S"),
        }


class Feedback(db.Model):
    __tablename__ = "feedback"
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    name = db.Column(db.String(120))
    email = db.Column(db.String(180))
    rating = db.Column(db.Integer)
    category = db.Column(db.String(80))
    message = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "email": self.email,
            "rating": self.rating,
            "category": self.category,
            "message": self.message,
            "date": self.created_at.strftime("%Y-%m-%d %H:%M:%S"),
        }


# ──────────────────────────────────────────────────────────────────────────
# PART 2: Auth helpers, register/login, history, feedback endpoints
# ──────────────────────────────────────────────────────────────────────────

def hash_password(password):
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def generate_token(user):
    payload = {
        "user_id": user.id,
        "email": user.email,
        "role": user.role,
        "exp": datetime.datetime.utcnow() + datetime.timedelta(days=7),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm="HS256")


def decode_token(token):
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None


def get_user_from_request():
    """Reads Authorization: Bearer <token> header and returns the User, or None."""
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return None
    token = auth_header.split(" ", 1)[1]
    payload = decode_token(token)
    if not payload:
        return None
    return User.query.get(payload["user_id"])


@app.route("/api/register", methods=["POST"])
def register():
    data = request.get_json(force=True) or {}
    name = (data.get("name") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not name or not email or not password:
        return jsonify({"error": "Name, email, and password are required."}), 400

    if User.query.filter_by(email=email).first():
        return jsonify({"error": "An account with this email already exists."}), 409

    user = User(name=name, email=email, password_hash=hash_password(password), role="user")
    db.session.add(user)
    db.session.commit()

    return jsonify({"message": "Registration successful", "user": user.to_dict()}), 201


@app.route("/api/login", methods=["POST"])
def login():
    data = request.get_json(force=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    user = User.query.filter_by(email=email).first()
    if not user or not user.check_password(password):
        return jsonify({"error": "Invalid email or password."}), 401

    token = generate_token(user)
    return jsonify({"message": "Login successful", "token": token, "user": user.to_dict()}), 200


@app.route("/api/history", methods=["GET"])
def get_history():
    user = get_user_from_request()
    if not user:
        return jsonify({"error": "Unauthorized"}), 401
    items = (
        HistoryItem.query.filter_by(user_id=user.id)
        .order_by(HistoryItem.created_at.asc())
        .all()
    )
    return jsonify({"history": [i.to_dict() for i in items]}), 200


@app.route("/api/history", methods=["POST"])
def add_history():
    user = get_user_from_request()
    if not user:
        return jsonify({"error": "Unauthorized"}), 401
    data = request.get_json(force=True) or {}
    item = HistoryItem(
        user_id=user.id,
        type=data.get("type", "Summary"),
        file_name=data.get("file", "Unknown"),
        summary=data.get("summary", ""),
    )
    db.session.add(item)
    db.session.commit()
    return jsonify({"message": "Saved", "item": item.to_dict()}), 201


@app.route("/api/history", methods=["DELETE"])
def clear_history():
    user = get_user_from_request()
    if not user:
        return jsonify({"error": "Unauthorized"}), 401
    HistoryItem.query.filter_by(user_id=user.id).delete()
    db.session.commit()
    return jsonify({"message": "History cleared"}), 200


@app.route("/api/feedback", methods=["POST"])
def submit_feedback():
    data = request.get_json(force=True) or {}
    rating = data.get("rating")
    message = (data.get("message") or "").strip()

    if not rating or not message:
        return jsonify({"error": "Rating and message are required."}), 400

    user = get_user_from_request()  # optional - feedback can be anonymous too
    fb = Feedback(
        user_id=user.id if user else None,
        name=data.get("name") or (user.name if user else "Anonymous"),
        email=data.get("email") or (user.email if user else ""),
        rating=int(rating),
        category=data.get("category", "General"),
        message=message,
    )
    db.session.add(fb)
    db.session.commit()
    return jsonify({"message": "Feedback submitted", "feedback": fb.to_dict()}), 201


@app.route("/api/feedback", methods=["GET"])
def list_feedback():
    user = get_user_from_request()
    if not user or user.role != "admin":
        return jsonify({"error": "Admin access required"}), 403
    items = Feedback.query.order_by(Feedback.created_at.desc()).all()
    return jsonify({"feedback": [f.to_dict() for f in items]}), 200


# ──────────────────────────────────────────────────────────────────────────
# PART 3: Admin endpoints, T5 summarization/Q&A endpoints, app startup
# ──────────────────────────────────────────────────────────────────────────

@app.route("/api/admin/users", methods=["GET"])
def admin_list_users():
    user = get_user_from_request()
    if not user or user.role != "admin":
        return jsonify({"error": "Admin access required"}), 403
    users = User.query.order_by(User.created_at.desc()).all()
    return jsonify({"users": [u.to_dict() for u in users]}), 200


@app.route("/api/admin/metrics", methods=["GET"])
def admin_metrics():
    user = get_user_from_request()
    if not user or user.role != "admin":
        return jsonify({"error": "Admin access required"}), 403
    return jsonify({
        "total_users": User.query.count(),
        "total_documents": HistoryItem.query.filter(HistoryItem.type != "Q&A").count(),
        "total_summaries": HistoryItem.query.count(),
        "total_feedback": Feedback.query.count(),
    }), 200


@app.route("/api/summarize", methods=["POST"])
def summarize():
    data = request.get_json(force=True) or {}
    text = data.get("text", "")
    try:
        summary = t5_summarize(text)
        return jsonify({"summary": summary}), 200
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": f"Summarization failed: {str(e)}"}), 500


@app.route("/api/ask", methods=["POST"])
def ask():
    data = request.get_json(force=True) or {}
    question = data.get("question", "")
    context = data.get("context", "")  # optional: pass the source document text
    try:
        answer = t5_answer_question(question, context)
        return jsonify({"answer": answer}), 200
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": f"Q&A failed: {str(e)}"}), 500


@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "model": T5_MODEL_NAME, "model_loaded": _model is not None}), 200


def ensure_admin_seed():
    """Optional: seed an admin user in the DB matching the frontend's
    hardcoded admin/admin1 shortcut, so admin can also log in via /api/login."""
    if not User.query.filter_by(email="admin").first():
        admin = User(
            name="Admin",
            email="admin",
            password_hash=hash_password("admin1"),
            role="admin",
        )
        db.session.add(admin)
        db.session.commit()


if __name__ == "__main__":
    with app.app_context():
        db.create_all()
        ensure_admin_seed()

    port = int(os.environ.get("PORT", 5000))
    # Preload the T5 model once at startup instead of waiting for first request
    # (comment out if you'd rather have a fast boot and lazy first request).
    try:
        get_t5()
    except Exception as e:
        print(f"[WARN] Could not preload T5 model at startup: {e}")
        print("It will be loaded lazily on first /api/summarize or /api/ask call.")

    app.run(host="0.0.0.0", port=port, debug=False)