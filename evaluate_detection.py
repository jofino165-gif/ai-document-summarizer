import json
import pickle
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
from transformers import pipeline

# Load label encoder
with open("label_encoder.pkl", "rb") as f:
    label_encoder = pickle.load(f)

# Load detection model
classifier = pipeline(
    "text-classification",
    model="./model/detection_model",
    tokenizer="./model/detection_model"
)

# Load test dataset
with open("real_test_dataset.json", "r") as f:
    data = json.load(f)

true_labels = []
predicted_labels = []

for item in data:
    text = item["text"]
    true_label = item["label"]

    prediction = classifier(text)[0]["label"]

    # Convert LABEL_0 -> actual class name
    index = int(prediction.replace("LABEL_", ""))
    predicted_label = label_encoder.inverse_transform([index])[0]

    true_labels.append(true_label)
    predicted_labels.append(predicted_label)

# Accuracy
accuracy = accuracy_score(true_labels, predicted_labels)

print("\n==============================")
print("MODEL EVALUATION")
print("==============================")
print(f"Accuracy: {accuracy * 100:.2f}%")

print("\nClassification Report")
print(classification_report(true_labels, predicted_labels))

print("\nConfusion Matrix")
print(confusion_matrix(true_labels, predicted_labels))
