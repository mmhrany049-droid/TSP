from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.book import Book, BookNode
from app.models.question import Question
from app.models.user import User
from app.schemas.dashboard import BookStatBrief, Checklist, DashboardSummary
from app.services.attempts import list_attempts
from app.services.stats import attempt_stats


def summary(db: Session, user: User) -> DashboardSummary:
    books = list(
        db.scalars(
            select(Book).where(Book.user_id == user.id, Book.is_active.is_(True)).order_by(Book.created_at.desc())
        ).all()
    )
    questions_count = int(
        db.scalar(
            select(func.count())
            .select_from(Question)
            .join(Book, Book.id == Question.book_id)
            .where(Book.user_id == user.id, Question.is_active.is_(True), Book.is_active.is_(True))
        )
        or 0
    )
    important_count = int(
        db.scalar(
            select(func.count())
            .select_from(Question)
            .join(Book, Book.id == Question.book_id)
            .where(
                Book.user_id == user.id,
                Question.is_active.is_(True),
                Question.is_important.is_(True),
            )
        )
        or 0
    )
    hard_count = int(
        db.scalar(
            select(func.count())
            .select_from(Question)
            .join(Book, Book.id == Question.book_id)
            .where(Book.user_id == user.id, Question.is_active.is_(True), Question.is_hard.is_(True))
        )
        or 0
    )
    has_chapter = (
        db.scalar(
            select(BookNode.id)
            .join(Book, Book.id == BookNode.book_id)
            .where(Book.user_id == user.id, BookNode.node_type == "chapter")
            .limit(1)
        )
        is not None
    )
    attempts = attempt_stats(db, user.id)
    recent, _total = list_attempts(db, user, question_id=None, book_id=None, result=None, source=None, attempted_from=None, attempted_to=None, page=1, size=8)

    continue_question = db.scalar(
        select(Question)
        .join(Book, Book.id == Question.book_id)
        .where(Book.user_id == user.id, Book.is_active.is_(True), Question.is_active.is_(True))
        .order_by(Question.created_at.desc())
        .limit(1)
    )
    book_briefs: list[BookStatBrief] = []
    for book in books[:8]:
        stats = attempt_stats(db, user.id, book_id=book.id)
        question_count = int(
            db.scalar(
                select(func.count())
                .select_from(Question)
                .where(Question.book_id == book.id, Question.is_active.is_(True))
            )
            or 0
        )
        book_briefs.append(
            BookStatBrief(
                id=book.id,
                title=book.title,
                subject=book.subject,
                question_count=question_count,
                attempt_count=stats.total,
                percentage=stats.percentage,
            )
        )
    return DashboardSummary(
        books_count=len(books),
        questions_count=questions_count,
        important_count=important_count,
        hard_count=hard_count,
        attempts=attempts,
        checklist=Checklist(
            has_book=len(books) > 0,
            has_chapter=has_chapter,
            has_question=questions_count > 0,
            has_attempt=attempts.total > 0,
        ),
        continue_book_id=continue_question.book_id if continue_question else (books[0].id if books else None),
        continue_question_id=continue_question.id if continue_question else None,
        books=book_briefs,
        recent_attempts=recent,
    )
