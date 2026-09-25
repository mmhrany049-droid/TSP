from typing import Literal

from pydantic import BaseModel, Field, field_validator

from app.constants import NODE_TYPES
from app.schemas.common import StatsOut, Timestamped

NodeType = Literal[
    "chapter",
    "section",
    "subsection",
    "mixed_tests",
    "checkup",
    "comprehensive",
    "other",
]


def _clean_required(value: str, message: str) -> str:
    cleaned = value.strip()
    if not cleaned:
        raise ValueError(message)
    return cleaned


def _clean_optional(value: str | None) -> str | None:
    if value is None:
        return None
    cleaned = value.strip()
    return cleaned or None


class BookCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    subject: str = Field(min_length=1, max_length=80)
    publisher: str | None = Field(default=None, max_length=120)
    grade: str | None = Field(default=None, max_length=40)
    field: str | None = Field(default="ریاضی-فیزیک", max_length=80)
    notes: str | None = Field(default=None, max_length=2000)

    @field_validator("title")
    @classmethod
    def title_required(cls, value: str) -> str:
        return _clean_required(value, "عنوان کتاب الزامی است.")

    @field_validator("subject")
    @classmethod
    def subject_required(cls, value: str) -> str:
        return _clean_required(value, "نام درس الزامی است.")

    @field_validator("publisher", "grade", "field", "notes")
    @classmethod
    def optional_text(cls, value: str | None) -> str | None:
        return _clean_optional(value)


class BookUpdate(BaseModel):
    title: str | None = Field(default=None, max_length=200)
    subject: str | None = Field(default=None, max_length=80)
    publisher: str | None = Field(default=None, max_length=120)
    grade: str | None = Field(default=None, max_length=40)
    field: str | None = Field(default=None, max_length=80)
    notes: str | None = Field(default=None, max_length=2000)
    is_active: bool | None = None

    @field_validator("title")
    @classmethod
    def title_not_blank(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return _clean_required(value, "عنوان کتاب نمی‌تواند خالی باشد.")

    @field_validator("subject")
    @classmethod
    def subject_not_blank(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return _clean_required(value, "نام درس نمی‌تواند خالی باشد.")

    @field_validator("publisher", "grade", "field", "notes")
    @classmethod
    def optional_text(cls, value: str | None) -> str | None:
        return _clean_optional(value)


class BookOut(Timestamped):
    id: str
    title: str
    subject: str
    publisher: str | None
    grade: str | None
    field: str | None
    notes: str | None
    is_active: bool
    question_count: int = 0
    attempt_count: int = 0
    percentage: float | None = None


class BookNodeCreate(BaseModel):
    parent_id: str | None = None
    node_type: NodeType
    title: str = Field(min_length=1, max_length=200)
    order_index: int | None = Field(default=None, ge=0)

    @field_validator("title")
    @classmethod
    def title_required(cls, value: str) -> str:
        return _clean_required(value, "عنوان گره الزامی است.")

    @field_validator("node_type")
    @classmethod
    def known_type(cls, value: str) -> str:
        if value not in NODE_TYPES:
            raise ValueError("نوع گره معتبر نیست.")
        return value


class BookNodeUpdate(BaseModel):
    parent_id: str | None = None
    node_type: NodeType | None = None
    title: str | None = Field(default=None, max_length=200)
    order_index: int | None = Field(default=None, ge=0)

    @field_validator("title")
    @classmethod
    def title_not_blank(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return _clean_required(value, "عنوان گره نمی‌تواند خالی باشد.")


class BookNodeOut(BaseModel):
    id: str
    book_id: str
    parent_id: str | None
    node_type: str
    title: str
    order_index: int
    question_count: int = 0
    children: list["BookNodeOut"] = []


class BookDetail(BookOut):
    nodes: list[BookNodeOut] = []
    stats: StatsOut
