from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.attempt import QuestionAttempt
from app.models.book import Book
from app.models.question import Question
from app.schemas.common import StatsOut


def empty_stats() -> StatsOut:
    return StatsOut(total=0, correct=0, wrong=0, unanswered=0, percentage=None)


def percentage(correct: int, total: int) -> float | None:
    if total == 0:
        return None
    return round(correct * 100 / total, 1)


def attempt_stats(
    db: Session,
    user_id: str,
    *,
    book_id: str | None = None,
    question_id: str | None = None,
) -> StatsOut:
    """درصد = تعداد درست / کل تلاش‌ها × ۱۰۰. از روی رکوردهای خام محاسبه می‌شود."""
    stmt = (
        select(QuestionAttempt.result, func.count())
        .join(Question, Question.id == QuestionAttempt.question_id)
        .join(Book, Book.id == Question.book_id)
        .where(Book.user_id == user_id)
        .group_by(QuestionAttempt.result)
    )
    if book_id is not None:
        stmt = stmt.where(Book.id == book_id)
    if question_id is not None:
        stmt = stmt.where(Question.id == question_id)
    counts = {"correct": 0, "wrong": 0, "unanswered": 0}
    for result, count in db.execute(stmt).all():
        if result in counts:
            counts[result] = int(count)
    total = counts["correct"] + counts["wrong"] + counts["unanswered"]
    return StatsOut(
        total=total,
        correct=counts["correct"],
        wrong=counts["wrong"],
        unanswered=counts["unanswered"],
        percentage=percentage(counts["correct"], total),
    )
