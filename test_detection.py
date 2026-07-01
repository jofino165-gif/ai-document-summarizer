import json
import torch
from transformers import AutoTokenizer, AutoModelForSequenceClassification
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import accuracy_score
MODEL_PATH = "./model/detection_model"
# Load model
tokenizer = AutoTokenizer.from_pretrained(MODEL_PATH)
model = AutoModelForSequenceClassification.from_pretrained(MODEL_PATH)

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
model.to(device)
model.eval()

# Load dataset
data = json.load(open("detection_dataset.json"))

texts = [x["text"] for x in data]
labels = [x["label"] for x in data]

# Encode labels properly
le = LabelEncoder()
y = le.fit_transform(labels)

# Split dataset
X_train, X_test, y_train, y_test = train_test_split(
    texts, y, test_size=0.2, random_state=42
)

preds = []

for text in X_test:
    inputs = tokenizer(text, return_tensors="pt", truncation=True, max_length=128).to(device)

    with torch.no_grad():
        outputs = model(**inputs)

    pred = torch.argmax(outputs.logits, dim=1).item()
    preds.append(pred)

acc = accuracy_score(y_test, preds)

print("🎯 REAL Detection Accuracy:", acc)
