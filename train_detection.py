import json
import numpy as np
import torch

from sklearn.preprocessing import LabelEncoder
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score

from transformers import (
    AutoTokenizer,
    AutoModelForSequenceClassification,
    Trainer,
    TrainingArguments
)

from torch.utils.data import Dataset

# ---------------------------------------
# LOAD DATASET
# ---------------------------------------
with open("detection_dataset_large.json", "r") as f:
    data = json.load(f)

texts = [item["text"] for item in data]
labels = [item["label"] for item in data]

# ---------------------------------------
# LABEL ENCODING
# ---------------------------------------
label_encoder = LabelEncoder()
labels = label_encoder.fit_transform(labels)

# Save label mapping
label_map = {
    str(i): label
    for i, label in enumerate(label_encoder.classes_)
}

with open("label_mapping.json", "w") as f:
    json.dump(label_map, f, indent=4)

# ---------------------------------------
# TRAIN TEST SPLIT
# ---------------------------------------
X_train, X_test, y_train, y_test = train_test_split(
    texts,
    labels,
    test_size=0.2,
    random_state=42,
    stratify=labels
)

# ---------------------------------------
# MODEL
# ---------------------------------------
MODEL_NAME = "distilbert-base-uncased"

tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)

# ---------------------------------------
# DATASET CLASS
# ---------------------------------------
class DetectionDataset(Dataset):

    def __init__(self, texts, labels):
        self.texts = texts
        self.labels = labels

    def __len__(self):
        return len(self.texts)

    def __getitem__(self, idx):

        encoding = tokenizer(
            self.texts[idx],
            truncation=True,
            padding="max_length",
            max_length=128,
            return_tensors="pt"
        )

        item = {
            key: value.squeeze(0)
            for key, value in encoding.items()
        }

        item["labels"] = torch.tensor(
            self.labels[idx],
            dtype=torch.long
        )

        return item


train_dataset = DetectionDataset(X_train, y_train)
test_dataset = DetectionDataset(X_test, y_test)

# ---------------------------------------
# LOAD MODEL
# ---------------------------------------
model = AutoModelForSequenceClassification.from_pretrained(
    MODEL_NAME,
    num_labels=len(label_encoder.classes_)
)

# ---------------------------------------
# METRICS
# ---------------------------------------
def compute_metrics(eval_pred):

    predictions, labels = eval_pred

    predictions = np.argmax(predictions, axis=1)

    accuracy = accuracy_score(labels, predictions)

    return {
        "accuracy": accuracy
    }

# ---------------------------------------
# TRAINING ARGUMENTS
# ---------------------------------------
training_args = TrainingArguments(
    output_dir="./detection_model",

    num_train_epochs=5,

    per_device_train_batch_size=8,
    per_device_eval_batch_size=8,

    learning_rate=2e-5,

    weight_decay=0.01,

    eval_strategy="epoch",

    save_strategy="epoch",

    logging_steps=10,

    save_total_limit=2,

    load_best_model_at_end=True,

    report_to=[]
)

# ---------------------------------------
# TRAINER
# ---------------------------------------
trainer = Trainer(
    model=model,
    args=training_args,
    train_dataset=train_dataset,
    eval_dataset=test_dataset,
    compute_metrics=compute_metrics
)

# ---------------------------------------
# TRAIN
# ---------------------------------------
print("\nStarting Detection Model Training...\n")

trainer.train()

# ---------------------------------------
# EVALUATE
# ---------------------------------------
results = trainer.evaluate()

print("\nEvaluation Results")
print(results)

# ---------------------------------------
# SAVE MODEL
# ---------------------------------------
trainer.save_model("./model/detection_model")

tokenizer.save_pretrained("./model/detection_model")

print("\nDetection model saved successfully!")

print("\nLabel Mapping:")
print(label_map)
