from datetime import datetime

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.utils.time import utcnow


class Book(Base):
    __tablename__ = "books"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    subject: Mapped[str] = mapped_column(String(80), nullable=False)
    publisher: Mapped[str | None] = mapped_column(String(120), nullable=True)
    grade: Mapped[str | None] = mapped_column(String(40), nullable=True)
    field: Mapped[str | None] = mapped_column(String(80), nullable=True, default="ریاضی-فیزیک")
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)

    owner: Mapped["User"] = relationship(back_populates="books")
    nodes: Mapped[list["BookNode"]] = relationship(
        back_populates="book",
        cascade="all, delete-orphan",
    )
    questions: Mapped[list["Question"]] = relationship(
        back_populates="book",
        cascade="all, delete-orphan",
    )


class BookNode(Base):
    """محل فیزیکی تست در کتاب. این موجودیت مبحث آموزشی نیست."""

    __tablename__ = "book_nodes"
    __table_args__ = (
        CheckConstraint(
            "node_type IN ('chapter', 'section', 'subsection', 'mixed_tests', 'checkup', 'comprehensive', 'other')",
            name="node_type",
        ),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    book_id: Mapped[str] = mapped_column(ForeignKey("books.id", ondelete="CASCADE"), index=True, nullable=False)
    parent_id: Mapped[str | None] = mapped_column(
        ForeignKey("book_nodes.id", ondelete="RESTRICT"),
        index=True,
        nullable=True,
    )
    node_type: Mapped[str] = mapped_column(String(32), nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    order_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    book: Mapped[Book] = relationship(back_populates="nodes")
    parent: Mapped["BookNode | None"] = relationship(
        back_populates="children",
        remote_side=lambda: [BookNode.id],
    )
    children: Mapped[list["BookNode"]] = relationship(back_populates="parent")
    questions: Mapped[list["Question"]] = relationship(back_populates="book_node")
