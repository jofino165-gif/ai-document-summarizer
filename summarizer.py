import os
from transformers import T5Tokenizer, T5ForConditionalGeneration

# =========================
# LOAD MODEL
# =========================
model_path = "trained_model"

tokenizer = T5Tokenizer.from_pretrained(model_path)
model = T5ForConditionalGeneration.from_pretrained(model_path)

# =========================
# DATASET PATH
# =========================
base_path = "dataset for summarization"
folders = ["study", "news", "legal", "healthcare"]

# =========================
# PROCESS EACH FOLDER
# =========================
for folder in folders:
    path = os.path.join(base_path, folder)

    print("\n====================")
    print("FOLDER:", folder)
    print("====================")

    # check folder exists
    if not os.path.exists(path):
        print("Folder not found:", path)
        continue

    for file in os.listdir(path)[:10]:
        file_path = os.path.join(path, file)

        # skip if not a file
        if not os.path.isfile(file_path):
            continue

        # =========================
        # READ FILE
        # =========================
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            text = f.read()

        # =========================
        # PREPARE INPUT
        # =========================
        input_text = "summarize: " + text[:800]

        inputs = tokenizer(
            input_text,
            return_tensors="pt",
            truncation=True
        )

        # =========================
        # GENERATE SUMMARY
        # =========================
        output = model.generate(
            inputs["input_ids"],
            max_length=120,
            min_length=30,
            num_beams=6,
            length_penalty=2.0,
            early_stopping=True
        )

        summary = tokenizer.decode(output[0], skip_special_tokens=True)

        # =========================
        # PRINT RESULT
        # =========================
        print("\nFILE:", file)
        print("SUMMARY:", summary)
