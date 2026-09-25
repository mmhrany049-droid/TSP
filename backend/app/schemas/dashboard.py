from pydantic import BaseModel

from app.schemas.attempt import AttemptOut
from app.schemas.common import StatsOut


class BookStatBrief(BaseModel):
    id: str
    title: str
    subject: str
    question_count: int
    attempt_count: int
    percentage: float | None


class Checklist(BaseModel):
    has_book: bool
    has_chapter: bool
    has_question: bool
    has_attempt: bool


class DashboardSummary(BaseModel):
    books_count: int
    questions_count: int
    important_count: int
    hard_count: int
    attempts: StatsOut
    checklist: Checklist
    continue_book_id: str | None
    continue_question_id: str | None
    books: list[BookStatBrief]
    recent_attempts: list[AttemptOut]
