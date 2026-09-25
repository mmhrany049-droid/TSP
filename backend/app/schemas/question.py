from pydantic import BaseModel, Field, field_validator

from app.schemas.book import _clean_optional, _clean_required
from app.schemas.common import Timestamped


class QuestionCreate(BaseModel):
    book_id: str
    book_node_id: str
    display_number: str = Field(min_length=1, max_length=50)
    correct_answer: str = Field(min_length=1, max_length=50)
    publisher_difficulty: str | None = Field(default=None, max_length=40)
    is_important: bool = False
    is_hard: bool = False

    @field_validator("display_number")
    @classmethod
    def number_required(cls, value: str) -> str:
        return _clean_required(value, "شماره نمایشی تست الزامی است.")

    @field_validator("correct_answer")
    @classmethod
    def answer_required(cls, value: str) -> str:
        return _clean_required(value, "پاسخ صحیح الزامی است.")

    @field_validator("publisher_difficulty")
    @classmethod
    def difficulty_optional(cls, value: str | None) -> str | None:
        return _clean_optional(value)


class QuestionUpdate(BaseModel):
    book_node_id: str | None = None
    display_number: str | None = Field(default=None, max_length=50)
    correct_answer: str | None = Field(default=None, max_length=50)
    publisher_difficulty: str | None = Field(default=None, max_length=40)
    is_important: bool | None = None
    is_hard: bool | None = None
    is_active: bool | None = None

    @field_validator("display_number")
    @classmethod
    def number_not_blank(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return _clean_required(value, "شماره نمایشی نمی‌تواند خالی باشد.")

    @field_validator("correct_answer")
    @classmethod
    def answer_not_blank(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return _clean_required(value, "پاسخ صحیح نمی‌تواند خالی باشد.")

    @field_validator("publisher_difficulty")
    @classmethod
    def difficulty_optional(cls, value: str | None) -> str | None:
        return _clean_optional(value)


class NodeBrief(BaseModel):
    id: str
    title: str
    node_type: str


class QuestionOut(Timestamped):
    id: str
    book_id: str
    book_node_id: str
    display_number: str
    correct_answer: str
    publisher_difficulty: str | None
    is_important: bool
    is_hard: bool
    is_active: bool
    book_title: str | None = None
    node_title: str | None = None
    path: list[NodeBrief] = []
    attempt_count: int = 0
    latest_result: str | None = None
