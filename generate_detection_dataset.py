import json
import random

study = [
    "Cybersecurity is important for protecting computer systems.",
    "Machine Learning is an important AI topic.",
    "Database normalization reduces redundancy.",
    "Operating System scheduling algorithms are important.",
    "Computer Networks use TCP/IP protocol."
]

health = [
    "Patient has high blood sugar.",
    "Blood pressure is very high.",
    "Chest pain and breathing difficulty observed.",
    "Patient has high cholesterol.",
    "Heart rate is abnormal."
]

news = [
    "Gas stock is decreasing rapidly.",
    "Oil prices increased today.",
    "Heavy rainfall warning issued.",
    "Food supply is becoming low.",
    "Electricity shortage expected."
]

legal = [
    "Contract expires in 5 days.",
    "Driving license expires next month.",
    "Insurance policy expires tomorrow.",
    "Passport renewal is required.",
    "Lease agreement ends this week."
]

dataset = []

for _ in range(25):
    dataset.append({
        "text": random.choice(study),
        "label": "study_important"
    })

for _ in range(25):
    dataset.append({
        "text": random.choice(health),
        "label": "health_risk"
    })

for _ in range(25):
    dataset.append({
        "text": random.choice(news),
        "label": "news_alert"
    })

for _ in range(25):
    dataset.append({
        "text": random.choice(legal),
        "label": "legal_expiry"
    })

random.shuffle(dataset)

with open("detection_dataset.json", "w") as f:
    json.dump(dataset, f, indent=4)

print("Dataset created successfully!")
print("Total samples:", len(dataset))
