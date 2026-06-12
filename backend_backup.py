from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import uuid
import datetime
import PyPDF2
from google import genai

# -----------------------------
# APP SETUP
# -----------------------------
app = Flask(__name__)
CORS(app)

# -----------------------------
# GEMINI CONFIG
# -----------------------------
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

if not GEMINI_API_KEY:
    raise Exception("GEMINI_API_KEY not found in environment variables")

client = genai.Client(api_key=GEMINI_API_KEY)

# -----------------------------
# IN-MEMORY STORAGE
# -----------------------------
USERS = {}
HISTORY = []
FEEDBACK = []

# Default admin
USERS["admin@admin.com"] = {
    "name": "Admin",
    "email": "admin@admin.com",
    "password": "admin1",
    "role": "admin"
}

# -----------------------------
# ROOT
# -----------------------------
@app.route("/")
def home():
    return jsonify({"message": "AI Summarizer Backend Running"})

# -----------------------------
# HEALTH CHECK
# -----------------------------
@app.route("/api/health")
def health():
    return jsonify({"status": "ok"})

# -----------------------------
# PDF UPLOAD
# -----------------------------
@app.route("/upload", methods=["POST"])
def upload_file():
    try:
        file = request.files["file"]

        pdf_reader = PyPDF2.PdfReader(file)
        text = ""

        for page in pdf_reader.pages:
            if page.extract_text():
                text += page.extract_text()

        return jsonify({"text": text})

    except Exception as e:
        return jsonify({"error": str(e)}), 500

# -----------------------------
# REGISTER
# -----------------------------
@app.route("/api/register", methods=["POST"])
def register():
    data = request.get_json()

    name = data.get("name")
    email = data.get("email")
    password = data.get("password")

    if not name or not email or not password:
        return jsonify({"error": "All fields required"}), 400

    if email in USERS:
        return jsonify({"error": "User already exists"}), 400

    USERS[email] = {
        "name": name,
        "email": email,
        "password": password,
        "role": "user"
    }

    return jsonify({"message": "Registration successful"})

# -----------------------------
# LOGIN
# -----------------------------
@app.route("/api/login", methods=["POST"])
def login():
    data = request.get_json()

    email = data.get("email")
    password = data.get("password")

    user = USERS.get(email)

    if not user:
        return jsonify({"error": "User not found"}), 404

    if user["password"] != password:
        return jsonify({"error": "Invalid password"}), 401

    return jsonify({
        "message": "Login successful",
        "user": {
            "name": user["name"],
            "email": user["email"],
            "role": user["role"]
        }
    })

# -----------------------------
# SUMMARIZE
# -----------------------------
@app.route("/api/summarize", methods=["POST"])
def summarize():
    try:
        data = request.get_json()
        text = data.get("text", "")
        email = data.get("email", "")

        if not text:
            return jsonify({"error": "Text required"}), 400

        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=f"Summarize this text in simple bullet points:\n\n{text}"
        )

        summary = response.text

        if email:
            HISTORY.append({
                "id": str(uuid.uuid4()),
                "email": email,
                "summary": summary,
                "date": str(datetime.datetime.now())
            })

        return jsonify({"summary": summary})

    except Exception as e:
        return jsonify({"error": str(e)}), 500

# -----------------------------
# Q&A (FIXED - THIS WAS MISSING)
# -----------------------------
@app.route("/api/ask", methods=["POST"])
def ask():
    try:
        data = request.get_json()
        question = data.get("question", "")

        if not question:
            return jsonify({"error": "Question required"}), 400

        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=f"Answer this question clearly and simply:\n\n{question}"
        )

        return jsonify({"answer": response.text})

    except Exception as e:
        return jsonify({"error": str(e)}), 500

# -----------------------------
# HISTORY
# -----------------------------
@app.route("/api/history/<email>", methods=["GET"])
def history(email):
    user_history = [h for h in HISTORY if h["email"] == email]
    return jsonify(user_history)

# -----------------------------
# FEEDBACK
# -----------------------------
@app.route("/api/feedback", methods=["POST"])
def feedback():
    data = request.get_json()
    FEEDBACK.append(data)
    return jsonify({"message": "Feedback saved"})

@app.route("/api/feedback", methods=["GET"])
def get_feedback():
    return jsonify(FEEDBACK)

# -----------------------------
# ADMIN STATS
# -----------------------------
@app.route("/api/admin/stats")
def stats():
    return jsonify({
        "users": len(USERS),
        "feedback": len(FEEDBACK),
        "history": len(HISTORY)
    })

# -----------------------------
# RUN SERVER
# -----------------------------
if __name__ == "__main__":
    print("Backend Running on Port 5000")
    app.run(host="0.0.0.0", port=5000, debug=False)