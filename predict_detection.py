import json
import torch

from transformers import AutoTokenizer
from transformers import AutoModelForSequenceClassification

# -----------------------------
# Load Model
# -----------------------------
MODEL_PATH = "./model/detection_model"

tokenizer = AutoTokenizer.from_pretrained(MODEL_PATH)
model = AutoModelForSequenceClassification.from_pretrained(MODEL_PATH)

model.eval()

# -----------------------------
# Load Label Mapping
# -----------------------------
with open("label_mapping.json", "r") as f:
    label_map = json.load(f)

# -----------------------------
# User Input
# -----------------------------
text = input("Enter text: ")

# -----------------------------
# Predict
# -----------------------------
inputs = tokenizer(
    text,
    return_tensors="pt",
    truncation=True,
    padding=True,
    max_length=128
)

with torch.no_grad():
    outputs = model(**inputs)
    prediction = torch.argmax(outputs.logits, dim=1).item()

print("\nPrediction:", label_map[str(prediction)])

