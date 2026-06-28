import os
from rouge_score import rouge_scorer
from transformers import T5Tokenizer, T5ForConditionalGeneration

# ================= MODEL =================
model_path = "trained_model"

tokenizer = T5Tokenizer.from_pretrained(model_path)
model = T5ForConditionalGeneration.from_pretrained(model_path)

# ================= DATASET =================
base_path = "dataset for summarization"
folders = ["study", "news", "legal", "healthcare"]

scorer = rouge_scorer.RougeScorer(
    ['rouge1', 'rouge2', 'rougeL'],
    use_stemmer=True
)

# ================= TOTAL SCORES =================
r1_f1, r2_f1, rL_f1 = 0, 0, 0
count = 0

# ================= LOOP DATA =================
for folder in folders:
    path = os.path.join(base_path, folder)

    print("\n====================")
    print("FOLDER:", folder)
    print("====================")

    for file in os.listdir(path):
        file_path = os.path.join(path, file)

        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            text = f.read()

        # input to model
        input_text = "summarize: " + text[:512]

        inputs = tokenizer(input_text, return_tensors="pt", truncation=True)

        output = model.generate(
            inputs["input_ids"],
            max_length=80,
            num_beams=4,
            early_stopping=True
        )

        generated = tokenizer.decode(output[0], skip_special_tokens=True)

        # reference = original text (simple evaluation method)
        reference = text[:200]

        scores = scorer.score(reference, generated)

        r1_f1 += scores['rouge1'].fmeasure
        r2_f1 += scores['rouge2'].fmeasure
        rL_f1 += scores['rougeL'].fmeasure

        count += 1

        print("FILE:", file)
        print("ROUGE-1:", scores['rouge1'].fmeasure)

# ================= FINAL RESULT =================
print("\n================ FINAL RESULT ================")
print("TOTAL FILES:", count)
print("AVERAGE ROUGE-1:", r1_f1 / count)
print("AVERAGE ROUGE-2:", r2_f1 / count)
print("AVERAGE ROUGE-L:", rL_f1 / count)
print("=============================================")
