from datetime import datetime, timezone
from uuid import uuid4
from sqlalchemy import String, Integer, Boolean, DateTime, ForeignKey, Text, Float, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import event
from sqlalchemy.orm.exc import FlushError
from ..database import Base

def uid(): return str(uuid4())
def now(): return datetime.now(timezone.utc)

class User(Base):
    __tablename__ = "users"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    name: Mapped[str | None] = mapped_column(String(120))
    password_hash: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)

class Book(Base):
    __tablename__ = "books"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(200)); subject: Mapped[str] = mapped_column(String(100))
    publisher: Mapped[str | None] = mapped_column(String(120)); grade: Mapped[str | None] = mapped_column(String(50))
    field: Mapped[str] = mapped_column(String(100), default="ریاضی-فیزیک"); notes: Mapped[str | None] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True); created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)

class BookNode(Base):
    __tablename__ = "book_nodes"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid); book_id: Mapped[str] = mapped_column(ForeignKey("books.id", ondelete="CASCADE"), index=True)
    parent_id: Mapped[str | None] = mapped_column(ForeignKey("book_nodes.id", ondelete="CASCADE")); node_type: Mapped[str] = mapped_column(String(30), default="chapter")
    title: Mapped[str] = mapped_column(String(200)); order_index: Mapped[int] = mapped_column(Integer, default=0); is_active: Mapped[bool] = mapped_column(Boolean, default=True)

class Topic(Base):
    __tablename__ = "topics"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid); user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    subject: Mapped[str] = mapped_column(String(100)); parent_id: Mapped[str | None] = mapped_column(ForeignKey("topics.id", ondelete="SET NULL")); title: Mapped[str] = mapped_column(String(200)); status: Mapped[str] = mapped_column(String(20), default="active")

class Question(Base):
    __tablename__ = "questions"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid); book_id: Mapped[str] = mapped_column(ForeignKey("books.id", ondelete="CASCADE"), index=True)
    book_node_id: Mapped[str] = mapped_column(ForeignKey("book_nodes.id", ondelete="CASCADE"), index=True); display_number: Mapped[str] = mapped_column(String(50), index=True)
    correct_answer: Mapped[str] = mapped_column(String(100)); publisher_difficulty: Mapped[str | None] = mapped_column(String(50)); is_important: Mapped[bool] = mapped_column(Boolean, default=False)
    is_hard: Mapped[bool] = mapped_column(Boolean, default=False); is_active: Mapped[bool] = mapped_column(Boolean, default=True); created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)

class QuestionTopic(Base):
    __tablename__ = "question_topics"
    __table_args__ = (UniqueConstraint("question_id", "topic_id", name="uq_question_topic"),)
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid); question_id: Mapped[str] = mapped_column(ForeignKey("questions.id", ondelete="CASCADE"), index=True)
    topic_id: Mapped[str] = mapped_column(ForeignKey("topics.id", ondelete="CASCADE"), index=True); relation_type: Mapped[str] = mapped_column(String(20), default="primary")

class QuestionAttempt(Base):
    __tablename__ = "question_attempts"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid); question_id: Mapped[str] = mapped_column(ForeignKey("questions.id", ondelete="CASCADE"), index=True)
    user_answer: Mapped[str | None] = mapped_column(String(100)); result: Mapped[str] = mapped_column(String(20)); spent_seconds: Mapped[int | None] = mapped_column(Integer)
    attempted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, index=True); source: Mapped[str] = mapped_column(String(20), default="manual")

class PreviousSolvedEntry(Base):
    __tablename__ = "previous_solved_entries"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid); question_id: Mapped[str] = mapped_column(ForeignKey("questions.id", ondelete="CASCADE"), index=True)
    user_answer: Mapped[str | None] = mapped_column(String(100)); result: Mapped[str] = mapped_column(String(20)); note: Mapped[str | None] = mapped_column(Text)
    imported_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now); import_batch: Mapped[str | None] = mapped_column(String(100))

class TeachingRecord(Base):
    __tablename__ = "teaching_records"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid); topic_id: Mapped[str] = mapped_column(ForeignKey("topics.id", ondelete="CASCADE"), unique=True)
    taught_status: Mapped[str] = mapped_column(String(20), default="not_taught"); taught_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True)); notes: Mapped[str | None] = mapped_column(Text)

class TeachingGoal(Base):
    __tablename__ = "teaching_goals"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid); topic_id: Mapped[str] = mapped_column(ForeignKey("topics.id", ondelete="CASCADE"), index=True)
    target_count: Mapped[int] = mapped_column(Integer); period_start: Mapped[datetime | None] = mapped_column(DateTime(timezone=True)); period_end: Mapped[datetime | None] = mapped_column(DateTime(timezone=True)); notes: Mapped[str | None] = mapped_column(Text)

class Exam(Base):
    __tablename__ = "exams"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid); user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(200)); exam_type: Mapped[str] = mapped_column(String(30), default="single_subject"); planned_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True)); notes: Mapped[str | None] = mapped_column(Text); created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)

class ExamTopic(Base):
    __tablename__ = "exam_topics"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid); exam_id: Mapped[str] = mapped_column(ForeignKey("exams.id", ondelete="CASCADE"), index=True); topic_id: Mapped[str] = mapped_column(ForeignKey("topics.id", ondelete="CASCADE"))

class ExamQuestion(Base):
    __tablename__ = "exam_questions"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid); exam_id: Mapped[str] = mapped_column(ForeignKey("exams.id", ondelete="CASCADE"), index=True)
    question_id: Mapped[str | None] = mapped_column(ForeignKey("questions.id", ondelete="SET NULL")); order_index: Mapped[int] = mapped_column(Integer, default=0); correct_answer: Mapped[str | None] = mapped_column(String(100))

class ExamAttempt(Base):
    __tablename__ = "exam_attempts"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid); exam_id: Mapped[str] = mapped_column(ForeignKey("exams.id", ondelete="CASCADE"), index=True)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now); finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True)); score_summary: Mapped[str | None] = mapped_column(Text)

class ExamAnswer(Base):
    __tablename__ = "exam_answers"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid); exam_attempt_id: Mapped[str] = mapped_column(ForeignKey("exam_attempts.id", ondelete="CASCADE"), index=True)
    exam_question_id: Mapped[str] = mapped_column(ForeignKey("exam_questions.id", ondelete="CASCADE")); user_answer: Mapped[str | None] = mapped_column(String(100)); result: Mapped[str] = mapped_column(String(20)); spent_seconds: Mapped[int | None] = mapped_column(Integer)

class ExamAsset(Base):
    __tablename__ = "exam_assets"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid); exam_id: Mapped[str | None] = mapped_column(ForeignKey("exams.id", ondelete="CASCADE")); exam_question_id: Mapped[str | None] = mapped_column(ForeignKey("exam_questions.id", ondelete="CASCADE"))
    file_type: Mapped[str] = mapped_column(String(20)); file_path: Mapped[str] = mapped_column(String(500)); original_name: Mapped[str | None] = mapped_column(String(255))

class FutureExamPlan(Base):
    __tablename__ = "future_exam_plans"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid); user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True); title: Mapped[str] = mapped_column(String(200))
    planned_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True)); readiness_estimate: Mapped[float | None] = mapped_column(Float); notes: Mapped[str | None] = mapped_column(Text); created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)

class FutureExamPlanTopic(Base):
    __tablename__ = "future_exam_plan_topics"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid); plan_id: Mapped[str] = mapped_column(ForeignKey("future_exam_plans.id", ondelete="CASCADE"), index=True); topic_id: Mapped[str] = mapped_column(ForeignKey("topics.id", ondelete="CASCADE"))

@event.listens_for(QuestionAttempt, "before_update")
def prevent_attempt_update(mapper, connection, target):
    raise ValueError("سوابق تلاش قابل ویرایش نیستند؛ برای اصلاح، تلاش تازه‌ای ثبت کنید")

class ReviewItem(Base):
    __tablename__ = "review_items"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid); question_id: Mapped[str] = mapped_column(ForeignKey("questions.id", ondelete="CASCADE"), index=True)
    reasons: Mapped[str] = mapped_column(Text); priority: Mapped[int] = mapped_column(Integer, default=1); status: Mapped[str] = mapped_column(String(20), default="pending"); created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now); resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
