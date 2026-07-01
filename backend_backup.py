from flask import Flask, request, jsonify
from flask_cors import CORS
import uuid
import datetime
import torch
import PyPDF2

from transformers import (
    AutoTokenizer,
    AutoModelForSeq2SeqLM,
    AutoModelForSequenceClassification
)

import pickle

# -----------------------------
# APP SETUP
# -----------------------------
app = Flask(__name__)
CORS(app)

# -----------------------------
# LOAD SUMMARIZATION MODEL
# -----------------------------
MODEL_PATH = "./model/checkpoint-1000"

tokenizer = AutoTokenizer.from_pretrained(MODEL_PATH)
model = AutoModelForSeq2SeqLM.from_pretrained(MODEL_PATH)

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
model.to(device)

# -----------------------------
# LOAD DETECTION MODEL
# -----------------------------
det_tokenizer = AutoTokenizer.from_pretrained("./detection_model")
det_model = AutoModelForSequenceClassification.from_pretrained("./detection_model")

det_model.to(device)

with open("label_encoder.pkl", "rb") as f:
    label_encoder = pickle.load(f)

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
    return jsonify({"message": "AI Summarizer + Detection Backend Running"})

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
# DETECTION FUNCTION
# -----------------------------
def detect_category(text):
    inputs = det_tokenizer(
        text,
        return_tensors="pt",
        truncation=True,
        padding=True,
        max_length=128
    ).to(device)

    outputs = det_model(**inputs)
    prediction = torch.argmax(outputs.logits, dim=1).item()

    label = label_encoder.inverse_transform([prediction])[0]
    return label

# -----------------------------
# SUMMARIZE + DETECT (MAIN FEATURE)
# -----------------------------
@app.route("/api/summarize", methods=["POST"])
def summarize():
    try:
        data = request.get_json()
        text = data.get("text", "")
        email = data.get("email", "")

        if not text:
            return jsonify({"error": "Text required"}), 400

        # ---------------- SUMMARIZATION ----------------
        inputs = tokenizer(
            text,
            return_tensors="pt",
            truncation=True,
            max_length=512
        ).to(device)

        summary_ids = model.generate(
            inputs["input_ids"],
            max_length=150,
            min_length=30,
            length_penalty=2.0,
            num_beams=4
        )

        summary = tokenizer.decode(summary_ids[0], skip_special_tokens=True)

        # ---------------- DETECTION ----------------
        prediction = detect_category(summary)

        # ---------------- HISTORY ----------------
        if email:
            HISTORY.append({
                "id": str(uuid.uuid4()),
                "email": email,
                "summary": summary,
                "prediction": prediction,
                "date": str(datetime.datetime.now())
            })

        return jsonify({
            "summary": summary,
            "prediction": prediction
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500

# -----------------------------
# Q&A
# -----------------------------
@app.route("/api/ask", methods=["POST"])
def ask():
    try:
        data = request.get_json()
        question = data.get("question", "")

        if not question:
            return jsonify({"error": "Question required"}), 400

        inputs = tokenizer(
            question,
            return_tensors="pt",
            truncation=True,
            max_length=512
        ).to(device)

        output_ids = model.generate(
            inputs["input_ids"],
            max_length=150,
            num_beams=4
        )

        answer = tokenizer.decode(output_ids[0], skip_special_tokens=True)

        return jsonify({"answer": answer})

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
    print("🚀 AI Summarizer + Detection Backend Running on Port 5000")
    app.run(host="0.0.0.0", port=5000, debug=False)