"""
Flask backend for the AI Document Summarizer & Q&A app.

Endpoints (matches the contract documented in the React frontend):
  POST   /api/login
  POST   /api/register
  POST   /api/summarize          (multipart/form-data, JWT required)
  POST   /api/qa                 (JWT required)
  GET    /api/history            (JWT required)
  POST   /api/feedback           (JWT required)

  GET    /api/admin/dashboard    (admin JWT required)
  GET    /api/admin/users
  DELETE /api/admin/users/<id>
  GET    /api/admin/documents
  GET    /api/admin/history
  GET    /api/admin/feedback
  DELETE /api/admin/feedback/<id>
  GET    /api/admin/categories
  GET    /api/admin/model-status
  GET    /api/admin/system
  GET    /api/admin/logs
  GET    /api/admin/profile

Run with:
  python app.py
"""
import logging
import os
from collections import deque
from datetime import timedelta

from flask import Flask, g, jsonify, request
from flask_cors import CORS
from flask_jwt_extended import (
    JWTManager,
    create_access_token,
    get_jwt,
    jwt_required,
    verify_jwt_in_request,
)

import ai_pipeline
from transformers import pipeline
from models import Feedback, History, Question, User, db

# ─── App & config ────────────────────────────────────────────────────────────
app = Flask(__name__)
CORS(app)

DB_URL = os.environ.get("DATABASE_URL")

if not DB_URL:
    raise RuntimeError("DATABASE_URL is not set. MySQL database is required.")
app.config["SQLALCHEMY_DATABASE_URI"] = DB_URL
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.config["JWT_SECRET_KEY"] = os.environ.get("JWT_SECRET_KEY", "dev-secret-change-me")
app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(
    hours=int(os.environ.get("JWT_EXPIRES_HOURS", "24"))
)
app.config["MAX_CONTENT_LENGTH"] = int(
    os.environ.get("MAX_UPLOAD_MB", "20")
) * 1024 * 1024

db.init_app(app)
jwt = JWTManager(app)

# In-memory ring buffer of recent request/event logs, surfaced at
# GET /api/admin/logs. Simple and process-local by design; swap for a real
# log store if this needs to survive restarts or scale beyond one process.
_LOG_BUFFER = deque(maxlen=200)
logger = logging.getLogger("ai_summarizer")
logging.basicConfig(level=logging.INFO)


def log_event(message):
    entry = {"timestamp": _now_str(), "message": message}
    _LOG_BUFFER.appendleft(entry)
    logger.info(message)


def _now_str():
    from datetime import datetime

    return datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")


# ─── Helpers ─────────────────────────────────────────────────────────────────
def error_response(message, status=400):
    return jsonify({"error": message}), status


def admin_required(fn):
    """Decorator: require a valid JWT whose claims mark the user as admin."""
    import functools

    @functools.wraps(fn)
    def wrapper(*args, **kwargs):
        verify_jwt_in_request()
        claims = get_jwt()
        if not claims.get("is_admin"):
            return error_response("Admin privileges required.", 403)
        return fn(*args, **kwargs)

    return wrapper


def current_user():
    from flask_jwt_extended import get_jwt_identity

    user_id = get_jwt_identity()
    return db.session.get(User, int(user_id)) if user_id else None


# ─── Auth endpoints ──────────────────────────────────────────────────────────
@app.route("/api/register", methods=["POST"])
def register():
    data = request.get_json(silent=True) or {}
    username = (data.get("username") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not username or not email or not password:
        return error_response("username, email and password are required.")
    if len(password) < 6:
        return error_response("Password must be at least 6 characters.")
    if User.query.filter_by(email=email).first():
        return error_response("An account with this email already exists.", 409)

    user = User(username=username, email=email)
    user.set_password(password)
    db.session.add(user)
    db.session.commit()

    log_event(f"New user registered: {email}")
    return jsonify({"message": "Registration successful", "user": user.to_public_dict()}), 201


@app.route("/api/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    user = User.query.filter_by(email=email).first()
    if not user or not user.check_password(password):
        return error_response("Invalid credentials.", 401)

    token = create_access_token(
        identity=str(user.id), additional_claims={"is_admin": user.is_admin}
    )
    log_event(f"Login: {email}")
    return jsonify({"token": token, "user": user.to_public_dict()})


# ─── Core app endpoints ──────────────────────────────────────────────────────
@app.route("/api/summarize", methods=["POST"])
@jwt_required()
def summarize():
    user = current_user()
    if user is None:
        return error_response("User not found.", 401)

    if "file" not in request.files:
        return error_response("No file uploaded.")
    file = request.files["file"]
    if not file.filename:
        return error_response("No file selected.")

    text, extract_error = ai_pipeline.extract_text(file)
    if extract_error:
        return error_response(extract_error)
    if not text.strip():
        return error_response("Could not extract any text from this file.")

    summary = ai_pipeline.summarize_text(text)
    category = ai_pipeline.classify_category(text)
    prediction = ai_pipeline.predict_document(category, text)
    recommendation = ai_pipeline.get_recommendation(category, text, prediction)

    entry = History(
        user_id=user.id,
        filename=file.filename,
        extracted_text=text,
        summary=summary,
        category=category,
        recommendation=recommendation,
    )
    db.session.add(entry)

    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        logger.exception("MYSQL SAVE ERROR in /api/summarize")
        return error_response(f"Database error: {str(e)}", 500)

    log_event(f"{user.email} summarized '{file.filename}' -> {category}")

    return jsonify(
    {
        "summary": summary,
        "category": category,
        "recommendation": recommendation,
        "prediction": prediction,
        "history_id": entry.id,
    }
)
@app.route("/api/qa", methods=["POST"])
@jwt_required()
def qa():
    user = current_user()
    if user is None:
        return error_response("User not found.", 401)

    data = request.get_json(silent=True) or {}
    history_id = data.get("history_id")
    question = (data.get("question") or "").strip()

    if not history_id:
        return error_response("history_id is required.")
    if not question:
        return error_response("question is required.")

    entry = db.session.get(History, history_id)
    if entry is None or entry.user_id != user.id:
        return error_response("Document not found.", 404)

    answer = ai_pipeline.answer_question(entry.extracted_text, question)

    record = Question(
        history_id=entry.id, user_id=user.id, question=question, answer=answer
    )
    db.session.add(record)
    db.session.commit()

    return jsonify({"answer": answer})


@app.route("/api/history", methods=["GET"])
@jwt_required()
def history():
    user = current_user()
    if user is None:
        return error_response("User not found.", 401)

    entries = (
        History.query.filter_by(user_id=user.id)
        .order_by(History.created_at.desc())
        .all()
    )
    return jsonify([entry.to_dict() for entry in entries])


@app.route("/api/feedback", methods=["POST"])
@jwt_required()
def feedback():
    user = current_user()
    if user is None:
        return error_response("User not found.", 401)

    data = request.get_json(silent=True) or {}
    rating = data.get("rating")
    category = data.get("category")
    comment = data.get("message") or data.get("comment") or ""

    if not rating:
        return error_response("rating is required.")

    entry = Feedback(user_id=user.id, rating=rating, category=category, comment=comment)
    db.session.add(entry)
    db.session.commit()

    log_event(f"{user.email} submitted feedback (rating={rating})")
    return jsonify({"message": "Feedback submitted", "id": entry.id}), 201


# ─── Admin endpoints ─────────────────────────────────────────────────────────
@app.route("/api/admin/dashboard", methods=["GET"])
@admin_required
def admin_dashboard():
    total_users = User.query.count()
    total_documents = History.query.count()
    total_summaries = History.query.filter(History.summary.isnot(None)).count()
    total_questions = Question.query.count()
    total_feedback = Feedback.query.count()

    from datetime import datetime, timedelta as td

    cutoff = datetime.utcnow() - td(days=7)
    active_users = (
        db.session.query(History.user_id)
        .filter(History.created_at >= cutoff)
        .distinct()
        .count()
    )

    return jsonify(
        {
            "total_users": total_users,
            "total_documents": total_documents,
            "total_summaries": total_summaries,
            "total_questions": total_questions,
            "total_feedback": total_feedback,
            "active_users": active_users,
        }
    )


@app.route("/api/admin/users", methods=["GET"])
@admin_required
def admin_users():
    users = User.query.order_by(User.created_at.desc()).all()
    return jsonify([u.to_admin_dict() for u in users])


@app.route("/api/admin/users/<int:user_id>", methods=["DELETE"])
@admin_required
def admin_delete_user(user_id):
    user = db.session.get(User, user_id)
    if user is None:
        return error_response("User not found.", 404)
    db.session.delete(user)
    db.session.commit()
    log_event(f"Admin deleted user #{user_id} ({user.email})")
    return jsonify({"message": "User deleted"})


@app.route("/api/admin/documents", methods=["GET"])
@admin_required
def admin_documents():
    entries = History.query.order_by(History.created_at.desc()).all()
    return jsonify([e.to_admin_document_dict() for e in entries])


@app.route("/api/admin/history", methods=["GET"])
@admin_required
def admin_history():
    entries = History.query.order_by(History.created_at.desc()).all()
    return jsonify([e.to_dict() for e in entries])


@app.route("/api/admin/feedback", methods=["GET"])
@admin_required
def admin_feedback():
    entries = Feedback.query.order_by(Feedback.created_at.desc()).all()
    return jsonify([e.to_dict() for e in entries])


@app.route("/api/admin/feedback/<int:feedback_id>", methods=["DELETE"])
@admin_required
def admin_delete_feedback(feedback_id):
    entry = db.session.get(Feedback, feedback_id)
    if entry is None:
        return error_response("Feedback not found.", 404)
    db.session.delete(entry)
    db.session.commit()
    log_event(f"Admin deleted feedback #{feedback_id}")
    return jsonify({"message": "Feedback deleted"})


@app.route("/api/admin/categories", methods=["GET"])
@admin_required
def admin_categories():
    counts = {key: 0 for key in ai_pipeline.CATEGORY_KEYS}
    rows = (
        db.session.query(History.category, db.func.count(History.id))
        .group_by(History.category)
        .all()
    )
    for category, count in rows:
        if category in counts:
            counts[category] = count
    return jsonify(counts)


@app.route("/api/admin/model-status", methods=["GET"])
@admin_required
def admin_model_status():
    return jsonify(ai_pipeline.MODEL_STATUS)


@app.route("/api/admin/system", methods=["GET"])
@admin_required
def admin_system():
    try:
        import psutil

        cpu = f"{psutil.cpu_percent(interval=0.2)}%"
        memory = f"{psutil.virtual_memory().percent}%"
        disk = f"{psutil.disk_usage('/').percent}%"
    except Exception:
        cpu = memory = disk = "N/A"
    return jsonify({"cpu": cpu, "memory": memory, "disk": disk})


@app.route("/api/admin/logs", methods=["GET"])
@admin_required
def admin_logs():
    return jsonify(list(_LOG_BUFFER))


@app.route("/api/admin/profile", methods=["GET"])
@admin_required
def admin_profile():
    user = current_user()
    if user is None:
        return error_response("Admin not found.", 404)
    return jsonify(
        {
            "Username": user.username,
            "Email": user.email,
            "Role": "Administrator",
            "Joined": user.created_at.strftime("%Y-%m-%d") if user.created_at else None,
        }
    )


# ─── Misc ────────────────────────────────────────────────────────────────────
@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})


@app.errorhandler(413)
def too_large(_err):
    return error_response("File too large.", 413)


with app.app_context():
    db.create_all()


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "5000"))
    debug = os.environ.get("FLASK_DEBUG", "1") == "1"
    app.run(host="0.0.0.0", port=port, debug=debug)
