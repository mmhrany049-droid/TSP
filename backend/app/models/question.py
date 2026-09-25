from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.utils.time import utcnow


class Question(Base):
    """تست بانک. متن سؤال عمداً فیلد ندارد و ذخیره نمی‌شود.

    display_number شماره نمایشی است و یکتا نیست؛ شناسه واقعی id است.
    """

    __tablename__ = "questions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    book_id: Mapped[str] = mapped_column(ForeignKey("books.id", ondelete="CASCADE"), index=True, nullable=False)
    book_node_id: Mapped[str] = mapped_column(
        ForeignKey("book_nodes.id", ondelete="RESTRICT"),
        index=True,
        nullable=False,
    )
    display_number: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    correct_answer: Mapped[str] = mapped_column(String(50), nullable=False)
    publisher_difficulty: Mapped[str | None] = mapped_column(String(40), nullable=True)
    is_important: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_hard: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)

    book: Mapped["Book"] = relationship(back_populates="questions")
    book_node: Mapped["BookNode"] = relationship(back_populates="questions")
    attempts: Mapped[list["QuestionAttempt"]] = relationship(
        back_populates="question",
        cascade="all, delete-orphan",
    )
