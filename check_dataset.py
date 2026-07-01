import json

with open("dataset.json", "r", encoding="utf-8") as f:
    data = json.load(f)

print("Total samples:", len(data))
print("\nFirst sample:\n", data[0])

print("\nKeys:", data[0].keys())
