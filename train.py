import json
from datasets import Dataset
from transformers import T5Tokenizer, T5ForConditionalGeneration, Trainer, TrainingArguments

# -------------------------
# LOAD DATASET
# -------------------------
with open("dataset.json", "r", encoding="utf-8") as f:
    data = json.load(f)

dataset = Dataset.from_list(data)

# -------------------------
# MODEL
# -------------------------
from transformers import T5Tokenizer, T5ForConditionalGeneration

model_name = "t5-base"

tokenizer = T5Tokenizer.from_pretrained(model_name)
model = T5ForConditionalGeneration.from_pretrained(model_name)

# -------------------------
# TOKENIZATION
# -------------------------
def preprocess(example):
    input_text = "summarize: " + example["text"][:512]
    target_text = example["summary"]

    model_inputs = tokenizer(
        input_text,
        max_length=512,
        truncation=True,
        padding="max_length"
    )

    labels = tokenizer(
        target_text,
        max_length=128,
        truncation=True,
        padding="max_length"
    )

    model_inputs["labels"] = labels["input_ids"]
    return model_inputs

tokenized = dataset.map(preprocess)

# -------------------------
# TRAIN SETTINGS
# -------------------------
training_args = TrainingArguments(
    output_dir="./model",
    num_train_epochs=5,
    per_device_train_batch_size=2,
    learning_rate=2e-5,
    save_strategy="epoch",
    logging_steps=10
)

trainer = Trainer(
    model=model,
    args=training_args,
    train_dataset=tokenized
)

# -------------------------
# TRAIN
# -------------------------
trainer.train()

# SAVE MODEL
model.save_pretrained("./trained_model")
tokenizer.save_pretrained("./trained_model")

print("TRAINING COMPLETED")
