import os
import json

base_path = "dataset for summarization"

folders = ["study", "news", "legal", "healthcare"]

data = []

for folder in folders:
    path = os.path.join(base_path, folder)

    for file in os.listdir(path):
        file_path = os.path.join(path, file)

        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            text = f.read()

        # ⚡ SIMPLE SUMMARY (temporary)
        summary = " ".join(text.split()[:40])   # first 40 words

        data.append({
            "text": text,
            "summary": summary
        })

# save dataset
with open("dataset.json", "w", encoding="utf-8") as f:
    json.dump(data, f, indent=4)

print("Dataset converted successfully!")
