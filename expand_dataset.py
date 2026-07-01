import json

with open("dataset.json", "r", encoding="utf-8") as f:
    data = json.load(f)

new_dataset = []

for item in data:
    text = item["text"]
    summary = item["summary"]

    # Original
    new_dataset.append({
        "text": text,
        "summary": summary
    })

    # Variation 1
    new_dataset.append({
        "text": text,
        "summary": summary + " This topic explains the main concepts clearly."
    })

    # Variation 2
    new_dataset.append({
        "text": text,
        "summary": "Overview: " + summary
    })

    # Variation 3
    new_dataset.append({
        "text": text,
        "summary": summary + " It highlights the important points and applications."
    })

    # Variation 4
    new_dataset.append({
        "text": text,
        "summary": summary + " This provides a concise understanding of the subject."
    })

with open("expanded_dataset.json", "w", encoding="utf-8") as f:
    json.dump(new_dataset, f, indent=2)

print("Original samples :", len(data))
print("Expanded samples :", len(new_dataset))
