"""
SQLAlchemy models for the AI Summarizer backend.

Tables:
- User:     account records, auth, admin flag
- History:  one row per summarized document (also holds the extracted text
            used later as QA context)
- Question: one row per question asked against a History item
- Feedback: user-submitted star rating + comment
"""
from datetime import datetime

from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import check_password_hash, generate_password_hash

db = SQLAlchemy()


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    is_admin = db.Column(db.Boolean, default=False, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    history = db.relationship(
        "History", backref="user", cascade="all, delete-orphan", lazy=True
    )
    questions = db.relationship(
        "Question", backref="user", cascade="all, delete-orphan", lazy=True
    )
    feedback_entries = db.relationship(
        "Feedback", backref="user", cascade="all, delete-orphan", lazy=True
    )

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def to_public_dict(self):
        """Shape returned as the `user` object on login/register."""
        return {
            "name": self.username,
            "email": self.email,
            "role": "admin" if self.is_admin else "user",
        }

    def to_admin_dict(self):
        """Shape returned by GET /api/admin/users."""
        return {
            "id": self.id,
            "username": self.username,
            "email": self.email,
            "joined": self.created_at.strftime("%Y-%m-%d") if self.created_at else None,
        }


class History(db.Model):
    __tablename__ = "history"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    filename = db.Column(db.String(255))
    extracted_text = db.Column(db.Text)  # kept as QA context
    summary = db.Column(db.Text)
    category = db.Column(db.String(64))
    recommendation = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    questions = db.relationship(
        "Question", backref="history", cascade="all, delete-orphan", lazy=True
    )

    def to_dict(self):
        """Shape returned by /api/summarize, /api/history, /api/admin/history."""
        return {
            "history_id": self.id,
            "id": self.id,
            "filename": self.filename,
            "type": self.category,
            "summary": self.summary,
            "category": self.category,
            "recommendation": self.recommendation,
            "uploaded_by": self.user.username if self.user else None,
            "date": self.created_at.strftime("%Y-%m-%d %H:%M") if self.created_at else None,
        }

    def to_admin_document_dict(self):
        """Shape returned by GET /api/admin/documents."""
        return {
            "id": self.id,
            "filename": self.filename,
            "category": self.category,
            "uploaded_by": self.user.username if self.user else None,
            "date": self.created_at.strftime("%Y-%m-%d %H:%M") if self.created_at else None,
        }


class Question(db.Model):
    __tablename__ = "questions"

    id = db.Column(db.Integer, primary_key=True)
    history_id = db.Column(db.Integer, db.ForeignKey("history.id"), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    question = db.Column(db.Text)
    answer = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class Feedback(db.Model):
    __tablename__ = "feedback"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    rating = db.Column(db.Integer)
    category = db.Column(db.String(64))
    comment = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        """Shape returned by GET /api/admin/feedback."""
        return {
            "id": self.id,
            "username": self.user.username if self.user else None,
            "rating": self.rating,
            "comment": self.comment,
            "category": self.category,
        }
