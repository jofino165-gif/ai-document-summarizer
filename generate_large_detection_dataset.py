import json
import random

study_templates = [
    "The topic {} is important for examinations.",
    "Students should study {} carefully.",
    "{} is a key concept in computer science.",
    "{} is frequently asked in exams.",
    "Understanding {} is essential."
]

study_topics = [
    "Cybersecurity", "Machine Learning", "Artificial Intelligence",
    "Database Management", "Operating Systems", "Computer Networks",
    "Python Programming", "Cloud Computing", "Data Structures",
    "Algorithms", "Encryption", "Firewalls", "CIA Triad",
    "Deep Learning", "Natural Language Processing"
]

health_templates = [
    "Patient has {}.",
    "{} requires immediate medical attention.",
    "{} indicates a health risk.",
    "{} was detected during examination.",
    "Medical report shows {}."
]

health_conditions = [
    "high blood sugar", "high cholesterol", "high blood pressure",
    "chest pain", "abnormal heart rate", "kidney infection",
    "liver disease", "diabetes", "fever", "lung infection",
    "low oxygen level", "heart disease"
]

news_templates = [
    "{} has been reported today.",
    "{} may affect the public.",
    "{} is expected next week.",
    "Authorities announced {}.",
    "{} is creating concern."
]

news_events = [
    "heavy rainfall", "gas shortage", "petrol shortage",
    "food shortage", "power outage", "earthquake warning",
    "flood alert", "stock market crash", "oil price increase",
    "cyclone warning", "water shortage"
]

legal_templates = [
    "{} expires soon.",
    "{} must be renewed.",
    "{} reaches its deadline next week.",
    "{} requires immediate renewal.",
    "{} is nearing expiry."
]

legal_docs = [
    "passport", "driving license", "insurance policy",
    "employment contract", "lease agreement",
    "visa", "tax certificate", "business license",
    "rental agreement", "ID card"
]

dataset = []

for _ in range(1000):
    dataset.append({
        "text": random.choice(study_templates).format(random.choice(study_topics)),
        "label": "study_important"
    })

for _ in range(1000):
    dataset.append({
        "text": random.choice(health_templates).format(random.choice(health_conditions)),
        "label": "health_risk"
    })

for _ in range(1000):
    dataset.append({
        "text": random.choice(news_templates).format(random.choice(news_events)),
        "label": "news_alert"
    })

for _ in range(1000):
    dataset.append({
        "text": random.choice(legal_templates).format(random.choice(legal_docs)),
        "label": "legal_expiry"
    })

random.shuffle(dataset)

with open("detection_dataset_large.json", "w") as f:
    json.dump(dataset, f, indent=4)

print("Dataset created successfully!")
print("Total samples:", len(dataset))
