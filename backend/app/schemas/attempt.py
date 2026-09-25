from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_serializer, field_validator

from app.schemas.common import ORMModel, StatsOut, serialize_datetime
from app.schemas.book import _clean_optional

AttemptSource = Literal["manual", "review", "exam", "import"]


class AttemptCreate(BaseModel):
    question_id: str
    user_answer: str | None = Field(default=None, max_length=50)
    spent_seconds: int | None = Field(default=None, ge=0, le=86400)
    source: AttemptSource = "manual"

    @field_validator("user_answer")
    @classmethod
    def blank_is_unanswered(cls, value: str | None) -> str | None:
        return _clean_optional(value)


class AttemptOut(ORMModel):
    id: str
    question_id: str
    user_answer: str | None
    result: str
    spent_seconds: int | None
    attempted_at: datetime
    source: str
    attempt_index: int | None = None
    display_number: str | None = None
    book_id: str | None = None
    book_title: str | None = None
    node_title: str | None = None

    @field_serializer("attempted_at")
    def _ser_attempted_at(self, value: datetime) -> str:
        return serialize_datetime(value)


class AttemptCreated(AttemptOut):
    correct_answer: str
    overall: StatsOut
    book: StatsOut
    question: StatsOut
