import json
import torch
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM
from rouge_score import rouge_scorer

MODEL_PATH = "./trained_model"

tokenizer = AutoTokenizer.from_pretrained(MODEL_PATH)
model = AutoModelForSeq2SeqLM.from_pretrained(MODEL_PATH)

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
model.to(device)
model.eval()

with open("dataset.json", "r", encoding="utf-8") as f:
    dataset = json.load(f)

scorer = rouge_scorer.RougeScorer(
    ["rouge1", "rouge2", "rougeL"],
    use_stemmer=True
)

rouge1 = 0
rouge2 = 0
rougeL = 0

# Test on first 50 samples
test_data = dataset[:50]

for sample in test_data:
    text = sample["text"]
    reference = sample["summary"]

    inputs = tokenizer(
        text,
        return_tensors="pt",
        truncation=True,
        max_length=512
    ).to(device)

    with torch.no_grad():
        outputs = model.generate(
            inputs["input_ids"],
            max_length=150,
            min_length=30,
            num_beams=4
        )

    prediction = tokenizer.decode(outputs[0], skip_special_tokens=True)

    scores = scorer.score(reference, prediction)

    rouge1 += scores["rouge1"].fmeasure
    rouge2 += scores["rouge2"].fmeasure
    rougeL += scores["rougeL"].fmeasure

n = len(test_data)

print("\n========== MODEL ACCURACY ==========")
print(f"ROUGE-1 : {rouge1/n:.4f} ({rouge1/n*100:.2f}%)")
print(f"ROUGE-2 : {rouge2/n:.4f} ({rouge2/n*100:.2f}%)")
print(f"ROUGE-L : {rougeL/n:.4f} ({rougeL/n*100:.2f}%)")
print("====================================")