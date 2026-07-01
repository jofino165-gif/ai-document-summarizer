import json
import re
from datasets import Dataset
from transformers import (
    T5Tokenizer,
    T5ForConditionalGeneration,
    Trainer,
    TrainingArguments,
)

# =========================
# LOAD DATASET
# =========================

with open("dataset.json", "r", encoding="utf-8") as f:
    data = json.load(f)

dataset = Dataset.from_list(data)

# =========================
# LOAD MODEL
# =========================

model_name = "t5-base"

tokenizer = T5Tokenizer.from_pretrained(model_name)
model = T5ForConditionalGeneration.from_pretrained(model_name)

# =========================
# CLEAN TEXT
# =========================

def clean_text(text):
    if not text:
        return ""

    if "Uploaded Notes:" in text:
        text = text.split("Uploaded Notes:")[1]

    if "Summary:" in text:
        text = text.split("Summary:")[0]

    text = re.sub(r"\s+", " ", text).strip()
    return text


def clean_summary(summary):
    if not summary:
        return ""

    summary = re.sub(r"Study ID:.*?Topic:", "", summary, flags=re.DOTALL)
    summary = re.sub(r"\s+", " ", summary).strip()

    return summary

# =========================
# TOKENIZATION
# =========================

def preprocess(example):
    input_text = "summarize: " + clean_text(example["text"])
    target_text = clean_summary(example["summary"])

    model_inputs = tokenizer(
        input_text,
        max_length=512,
        truncation=True,
        padding="max_length",
    )

    labels = tokenizer(
        target_text,
        max_length=128,
        truncation=True,
        padding="max_length",
    )

    label_ids = [
        token if token != tokenizer.pad_token_id else -100
        for token in labels["input_ids"]
    ]

    model_inputs["labels"] = label_ids
    return model_inputs


tokenized_dataset = dataset.map(
    preprocess,
    remove_columns=dataset.column_names
)

# =========================
# TRAINING ARGS
# =========================

training_args = TrainingArguments(
    output_dir="./model",
    overwrite_output_dir=True,
    num_train_epochs=10,
    learning_rate=5e-5,
    per_device_train_batch_size=4,
    weight_decay=0.01,
    save_strategy="epoch",
    logging_steps=20,
    logging_dir="./logs",
    report_to="none",
)

# =========================
# TRAINER
# =========================

trainer = Trainer(
    model=model,
    args=training_args,
    train_dataset=tokenized_dataset,
)

# =========================
# TRAIN
# =========================

print("Training Started...\n")
trainer.train()

# =========================
# SAVE MODEL
# =========================

trainer.save_model("./trained_model")
tokenizer.save_pretrained("./trained_model")

print("\nTraining Completed Successfully")
print("Model saved in ./trained_model")