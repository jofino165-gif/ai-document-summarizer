import json
import torch

from transformers import (
    AutoTokenizer,
    AutoModelForSeq2SeqLM,
    AutoModelForSequenceClassification
)

# -----------------------------
# Load Summarization Model
# -----------------------------
SUMMARIZER_PATH = "./trained_model"

summary_tokenizer = AutoTokenizer.from_pretrained(SUMMARIZER_PATH)
summary_model = AutoModelForSeq2SeqLM.from_pretrained(SUMMARIZER_PATH)

# -----------------------------
# Load Detection Model
# -----------------------------
DETECTION_PATH = "./model/detection_model"

detect_tokenizer = AutoTokenizer.from_pretrained(DETECTION_PATH)
detect_model = AutoModelForSequenceClassification.from_pretrained(DETECTION_PATH)

detect_model.eval()

# -----------------------------
# Load Labels
# -----------------------------
with open("label_mapping.json", "r") as f:
    label_map = json.load(f)

# -----------------------------
# Input
# -----------------------------
text = input("Enter document:\n")

# -----------------------------
# Summarization
# -----------------------------
inputs = summary_tokenizer(
    text,
    return_tensors="pt",
    truncation=True,
    max_length=512
)

summary_ids = summary_model.generate(
    **inputs,
    max_length=150,
    min_length=40,
    num_beams=4
)

summary = summary_tokenizer.decode(
    summary_ids[0],
    skip_special_tokens=True
)

# -----------------------------
# Detection
# -----------------------------
detect_inputs = detect_tokenizer(
    summary,
    return_tensors="pt",
    truncation=True,
    padding=True,
    max_length=128
)

with torch.no_grad():
    outputs = detect_model(**detect_inputs)
    prediction = torch.argmax(outputs.logits, dim=1).item()

label = label_map[str(prediction)]

# -----------------------------
# Recommendation
# -----------------------------
recommendations = {
    "study_important": "Focus on these topics for exams.",
    "health_risk": "Consult a healthcare professional.",
    "news_alert": "Monitor the situation for further updates.",
    "legal_expiry": "Review and renew before the deadline."
}

print("\n==============================")
print("SUMMARY")
print("==============================")
print(summary)

print("\n==============================")
print("DETECTION")
print("==============================")
print(label)

print("\n==============================")
print("RECOMMENDATION")
print("==============================")
print(recommendations.get(label, "No recommendation available."))
