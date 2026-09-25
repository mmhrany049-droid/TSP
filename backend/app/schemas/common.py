from datetime import datetime
from typing import Generic, TypeVar

from pydantic import BaseModel, ConfigDict, field_serializer

from app.utils.time import as_utc

T = TypeVar("T")


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class Message(BaseModel):
    detail: str


class Page(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    size: int
    pages: int


def serialize_datetime(value: datetime) -> str:
    return as_utc(value).isoformat()


class StatsOut(BaseModel):
    """آمار محاسبه‌شده از روی تلاش‌های خام. ذخیره نمی‌شود."""

    total: int
    correct: int
    wrong: int
    unanswered: int
    percentage: float | None


class Timestamped(ORMModel):
    created_at: datetime

    @field_serializer("created_at")
    def _ser_created_at(self, value: datetime) -> str:
        return serialize_datetime(value)
