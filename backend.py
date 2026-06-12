from dotenv import load_dotenv
load_dotenv()
from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
import os
import uuid
import datetime
import PyPDF2
from google import genai
from werkzeug.security import generate_password_hash, check_password_hash

# ─────────────────────────────────────────────
# APP SETUP
# ─────────────────────────────────────────────
app = Flask(__name__)
CORS(app)

# ─────────────────────────────────────────────
# AWS RDS MySQL CONFIG
# Set these as environment variables on your server:
#   DB_HOST     → your RDS endpoint  e.g. mydb.xxxx.us-east-1.rds.amazonaws.com
#   DB_PORT     → 3306  (default)
#   DB_NAME     → your database name  e.g. ai_summarizer
#   DB_USER     → your RDS username   e.g. admin
#   DB_PASSWORD → your RDS password
# ─────────────────────────────────────────────
DB_HOST     = os.getenv("DB_HOST",     "localhost")
DB_PORT     = os.getenv("DB_PORT",     "3306")
DB_NAME     = os.getenv("DB_NAME",     "ai_summarizer")
DB_USER     = os.getenv("DB_USER",     "aiuser")
DB_PASSWORD = os.getenv("DB_PASSWORD", "MyPass123!")

app.config["SQLALCHEMY_DATABASE_URI"] = (
    f"mysql+pymysql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
)
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

db = SQLAlchemy(app)

# ─────────────────────────────────────────────
# GEMINI CONFIG
# ─────────────────────────────────────────────
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    raise Exception("GEMINI_API_KEY not found in environment variables")

client = genai.Client(api_key=GEMINI_API_KEY)


# ─────────────────────────────────────────────
# DATABASE MODELS
# ─────────────────────────────────────────────

class User(db.Model):
    __tablename__ = "users"

    id            = db.Column(db.Integer, primary_key=True, autoincrement=True)
    name          = db.Column(db.String(120), nullable=False)
    email         = db.Column(db.String(200), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    role          = db.Column(db.String(20), default="user")
    registered_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)

    def set_password(self, raw):
        self.password_hash = generate_password_hash(raw)

    def check_password(self, raw):
        return check_password_hash(self.password_hash, raw)

    def to_dict(self):
        return {
            "id":            self.id,
            "name":          self.name,
            "email":         self.email,
            "role":          self.role,
            "registered_at": self.registered_at.strftime("%Y-%m-%d %H:%M:%S")
        }


class LoginLog(db.Model):
    __tablename__ = "login_logs"

    id         = db.Column(db.Integer, primary_key=True, autoincrement=True)
    email      = db.Column(db.String(200), nullable=False)
    login_time = db.Column(db.DateTime, default=datetime.datetime.utcnow)

    def to_dict(self):
        return {
            "id":         self.id,
            "email":      self.email,
            "login_time": self.login_time.strftime("%Y-%m-%d %H:%M:%S")
        }


class History(db.Model):
    __tablename__ = "history"

    id      = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email   = db.Column(db.String(200), nullable=False)
    type    = db.Column(db.String(100), default="Summarization")
    file    = db.Column(db.String(200), default="Uploaded File")
    summary = db.Column(db.Text)
    date    = db.Column(db.DateTime, default=datetime.datetime.utcnow)

    def to_dict(self):
        return {
            "id":      self.id,
            "email":   self.email,
            "type":    self.type,
            "file":    self.file,
            "summary": self.summary,
            "date":    self.date.strftime("%Y-%m-%d %H:%M:%S")
        }


class Feedback(db.Model):
    __tablename__ = "feedback"

    id       = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name     = db.Column(db.String(120), default="Anonymous")
    email    = db.Column(db.String(200))
    rating   = db.Column(db.Integer, nullable=False)
    category = db.Column(db.String(100), default="General")
    message  = db.Column(db.Text, nullable=False)
    date     = db.Column(db.DateTime, default=datetime.datetime.utcnow)

    def to_dict(self):
        return {
            "id":       self.id,
            "name":     self.name,
            "email":    self.email,
            "rating":   self.rating,
            "category": self.category,
            "message":  self.message,
            "date":     self.date.strftime("%Y-%m-%d %H:%M:%S")
        }


# ─────────────────────────────────────────────
# CREATE TABLES + SEED ADMIN
# ─────────────────────────────────────────────
def init_db():
    db.create_all()
    # Create default admin if not present
    if not User.query.filter_by(email="admin@admin.com").first():
        admin = User(name="Admin", email="admin@admin.com", role="admin")
        admin.set_password("admin1")
        db.session.add(admin)
        db.session.commit()
        print("✅ Default admin created: admin@admin.com / admin1")


# ─────────────────────────────────────────────
# HELPER
# ─────────────────────────────────────────────
def now():
    return datetime.datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")


# ─────────────────────────────────────────────
# ROOT
# ─────────────────────────────────────────────
@app.route("/")
def home():
    return jsonify({"message": "AI Summarizer Backend Running"})


# ─────────────────────────────────────────────
# HEALTH CHECK
# ─────────────────────────────────────────────
@app.route("/api/health")
def health():
    try:
        db.session.execute(db.text("SELECT 1"))
        return jsonify({"status": "ok", "db": "connected"})
    except Exception as e:
        return jsonify({"status": "error", "db": str(e)}), 500


# ─────────────────────────────────────────────
# REGISTER
# POST /api/register
# Body: { name, email, password }
# ─────────────────────────────────────────────
@app.route("/api/register", methods=["POST"])
def register():
    data = request.get_json()

    name = data.get("name", "").strip()
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")

    print("REGISTER REQUEST:", name, email)

    if not name or not email or not password:
        return jsonify({"error": "All fields required"}), 400

    if User.query.filter_by(email=email).first():
        return jsonify({"error": "Email already registered"}), 400

    user = User(name=name, email=email, role="user")
    user.set_password(password)

    db.session.add(user)
    db.session.commit()

    print("USER SAVED:", email)

    return jsonify({"message": "Registration successful"})

# ─────────────────────────────────────────────
# LOGIN
# POST /api/login
# Body: { email, password }
# ─────────────────────────────────────────────
@app.route("/api/login", methods=["POST"])
def login():
    data = request.get_json()

    email    = data.get("email", "").strip().lower()
    password = data.get("password", "")

    # Support shorthand "admin" from frontend
    if email == "admin":
        email = "admin@admin.com"

    user = User.query.filter_by(email=email).first()

    if not user:
        return jsonify({"error": "User not found"}), 404

    if not user.check_password(password):
        return jsonify({"error": "Invalid password"}), 401

    # Record login in SQL
    log = LoginLog(email=email)
    db.session.add(log)
    db.session.commit()

    return jsonify({
        "message": "Login successful",
        "user": {
            "name":  user.name,
            "email": user.email,
            "role":  user.role
        }
    })


# ─────────────────────────────────────────────
# PDF UPLOAD
# POST /upload
# ─────────────────────────────────────────────
@app.route("/upload", methods=["POST"])
def upload_file():
    try:
        file = request.files.get("file")
        if not file:
            return jsonify({"error": "No file provided"}), 400

        pdf_reader = PyPDF2.PdfReader(file)
        text = ""
        for page in pdf_reader.pages:
            extracted = page.extract_text()
            if extracted:
                text += extracted + "\n"

        return jsonify({"text": text.strip() or "Could not extract text from this PDF."})

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ─────────────────────────────────────────────
# SUMMARIZE
# POST /api/summarize
# Body: { text, email?, type?, file? }
# ─────────────────────────────────────────────
@app.route("/api/summarize", methods=["POST"])
def summarize():
    try:
        data  = request.get_json()
        text  = data.get("text", "").strip()
        email = data.get("email", "").strip().lower()

        if not text:
            return jsonify({"error": "Text is required"}), 400

        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=f"Summarize the following text in clear, concise bullet points:\n\n{text}"
        )
        summary = response.text

        # Persist to SQL if user email provided
        if email:
            entry = History(
                email   = email,
                type    = data.get("type", "Summarization"),
                file    = data.get("file", "Uploaded File"),
                summary = summary
            )
            db.session.add(entry)
            db.session.commit()

        return jsonify({"summary": summary})

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ─────────────────────────────────────────────
# Q&A
# POST /api/ask
# Body: { question, email? }
# ─────────────────────────────────────────────
@app.route("/api/ask", methods=["POST"])
def ask():
    try:
        data     = request.get_json()
        question = data.get("question", "").strip()
        email    = data.get("email", "").strip().lower()

        if not question:
            return jsonify({"error": "Question is required"}), 400

        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=f"Answer this question clearly and helpfully:\n\n{question}"
        )
        answer = response.text

        if email:
            entry = History(
                email   = email,
                type    = "Q&A",
                file    = "Question",
                summary = f"Q: {question}\nA: {answer}"
            )
            db.session.add(entry)
            db.session.commit()

        return jsonify({"answer": answer})

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ─────────────────────────────────────────────
# HISTORY — GET by email
# GET /api/history/<email>
# ─────────────────────────────────────────────
@app.route("/api/history/<email>", methods=["GET"])
def get_history(email):
    rows = History.query.filter_by(email=email.lower()).order_by(History.date.desc()).all()
    return jsonify([r.to_dict() for r in rows])


# ─────────────────────────────────────────────
# HISTORY — DELETE (clear) by email
# DELETE /api/history/<email>
# ─────────────────────────────────────────────
@app.route("/api/history/<email>", methods=["DELETE"])
def clear_history(email):
    History.query.filter_by(email=email.lower()).delete()
    db.session.commit()
    return jsonify({"message": "History cleared"})


# ─────────────────────────────────────────────
# FEEDBACK — submit
# POST /api/feedback
# ─────────────────────────────────────────────
@app.route("/api/feedback", methods=["POST"])
def submit_feedback():
    data = request.get_json()

    if not data.get("rating") or not data.get("message"):
        return jsonify({"error": "Rating and message are required"}), 400

    fb = Feedback(
        name     = data.get("name", "Anonymous"),
        email    = data.get("email", ""),
        rating   = int(data.get("rating")),
        category = data.get("category", "General"),
        message  = data.get("message")
    )
    db.session.add(fb)
    db.session.commit()

    return jsonify({"message": "Feedback saved"})


# ─────────────────────────────────────────────
# FEEDBACK — get all (admin)
# GET /api/feedback
# ─────────────────────────────────────────────
@app.route("/api/feedback", methods=["GET"])
def get_feedback():
    rows = Feedback.query.order_by(Feedback.date.desc()).all()
    return jsonify([r.to_dict() for r in rows])


# ─────────────────────────────────────────────
# ADMIN — all users
# GET /api/admin/users
# ─────────────────────────────────────────────
@app.route("/api/admin/users", methods=["GET"])
def get_users():
    rows = User.query.order_by(User.registered_at.asc()).all()
    return jsonify([r.to_dict() for r in rows])


# ─────────────────────────────────────────────
# ADMIN — login logs
# GET /api/admin/login-logs
# ─────────────────────────────────────────────
@app.route("/api/admin/login-logs", methods=["GET"])
def get_login_logs():
    rows = LoginLog.query.order_by(LoginLog.login_time.desc()).all()
    return jsonify([r.to_dict() for r in rows])


# ─────────────────────────────────────────────
# ADMIN — dashboard stats
# GET /api/admin/stats
# ─────────────────────────────────────────────
@app.route("/api/admin/stats", methods=["GET"])
def stats():
    today_start = datetime.datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)

    total_users   = User.query.count()
    total_logins  = LoginLog.query.count()
    logins_today  = LoginLog.query.filter(LoginLog.login_time >= today_start).count()
    total_history = History.query.count()
    total_feedback= Feedback.query.count()

    last_log = LoginLog.query.order_by(LoginLog.login_time.desc()).first()
    last_login = last_log.login_time.strftime("%Y-%m-%d %H:%M:%S") if last_log else None

    return jsonify({
        "users":         total_users,
        "total_logins":  total_logins,
        "logins_today":  logins_today,
        "history":       total_history,
        "feedback":      total_feedback,
        "last_login":    last_login
    })


# ─────────────────────────────────────────────
# ADMIN — login chart (last 7 days)
# GET /api/admin/login-chart
# ─────────────────────────────────────────────
@app.route("/api/admin/login-chart", methods=["GET"])
def login_chart():
    chart = []
    for i in range(6, -1, -1):
        day       = datetime.date.today() - datetime.timedelta(days=i)
        day_start = datetime.datetime.combine(day, datetime.time.min)
        day_end   = datetime.datetime.combine(day, datetime.time.max)
        count     = LoginLog.query.filter(
            LoginLog.login_time >= day_start,
            LoginLog.login_time <= day_end
        ).count()
        chart.append({
            "date":   day.strftime("%b %-d"),
            "logins": count
        })
    return jsonify(chart)


# ─────────────────────────────────────────────
# RUN
# ─────────────────────────────────────────────
if __name__ == "__main__":
    with app.app_context():
        init_db()
    print("✅ AI Summarizer Backend running on http://0.0.0.0:5000")
    app.run(host="0.0.0.0", port=5000, debug=False)