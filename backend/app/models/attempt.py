from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.utils.time import utcnow


class QuestionAttempt(Base):
    """هر حل یک رکورد جدید است. این جدول به‌روزرسانی نمی‌شود."""

    __tablename__ = "question_attempts"
    __table_args__ = (
        CheckConstraint("result IN ('correct', 'wrong', 'unanswered')", name="result"),
        CheckConstraint("source IN ('manual', 'review', 'exam', 'import')", name="source"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    question_id: Mapped[str] = mapped_column(
        ForeignKey("questions.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    user_answer: Mapped[str | None] = mapped_column(String(50), nullable=True)
    result: Mapped[str] = mapped_column(String(20), nullable=False)
    spent_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)
    attempted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False, index=True)
    source: Mapped[str] = mapped_column(String(20), nullable=False, default="manual")

    question: Mapped["Question"] = relationship(back_populates="attempts")
