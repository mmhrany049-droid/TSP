from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.attempt import QuestionAttempt
from app.models.book import Book, BookNode
from app.models.question import Question
from app.models.user import User
from app.schemas.attempt import AttemptCreate, AttemptCreated, AttemptOut
from app.services.access import get_owned_question
from app.services.stats import attempt_stats
from app.utils.answers import judge_answer


def _indexed_attempts(db: Session, user: User):
    index_subq = (
        select(
            QuestionAttempt.id.label("id"),
            func.row_number()
            .over(
                partition_by=QuestionAttempt.question_id,
                order_by=(QuestionAttempt.attempted_at.asc(), QuestionAttempt.id.asc()),
            )
            .label("attempt_index"),
        )
        .subquery()
    )
    return index_subq


def list_attempts(
    db: Session,
    user: User,
    *,
    question_id: str | None,
    book_id: str | None,
    result: str | None,
    source: str | None,
    attempted_from,
    attempted_to,
    page: int,
    size: int,
) -> tuple[list[AttemptOut], int]:
    index_subq = _indexed_attempts(db, user)
    stmt = (
        select(
            QuestionAttempt,
            index_subq.c.attempt_index,
            Question.display_number,
            Book.id,
            Book.title,
            BookNode.title,
        )
        .join(Question, Question.id == QuestionAttempt.question_id)
        .join(Book, Book.id == Question.book_id)
        .outerjoin(BookNode, BookNode.id == Question.book_node_id)
        .join(index_subq, index_subq.c.id == QuestionAttempt.id)
        .where(Book.user_id == user.id)
    )
    if question_id:
        get_owned_question(db, user, question_id)
        stmt = stmt.where(QuestionAttempt.question_id == question_id)
    if book_id:
        stmt = stmt.where(Book.id == book_id)
    if result:
        stmt = stmt.where(QuestionAttempt.result == result)
    if source:
        stmt = stmt.where(QuestionAttempt.source == source)
    if attempted_from is not None:
        stmt = stmt.where(QuestionAttempt.attempted_at >= attempted_from)
    if attempted_to is not None:
        stmt = stmt.where(QuestionAttempt.attempted_at <= attempted_to)

    count_stmt = select(func.count()).select_from(stmt.order_by(None).subquery())
    total = int(db.scalar(count_stmt) or 0)
    rows = db.execute(
        stmt.order_by(QuestionAttempt.attempted_at.desc(), QuestionAttempt.id.desc())
        .offset((page - 1) * size)
        .limit(size)
    ).all()
    items = [
        AttemptOut(
            id=attempt.id,
            question_id=attempt.question_id,
            user_answer=attempt.user_answer,
            result=attempt.result,
            spent_seconds=attempt.spent_seconds,
            attempted_at=attempt.attempted_at,
            source=attempt.source,
            attempt_index=int(attempt_index),
            display_number=display_number,
            book_id=book_id_value,
            book_title=book_title,
            node_title=node_title,
        )
        for attempt, attempt_index, display_number, book_id_value, book_title, node_title in rows
    ]
    return items, total


def create_attempt(db: Session, user: User, payload: AttemptCreate) -> AttemptCreated:
    """همیشه یک رکورد تازه درج می‌کند. تلاش قبلی هرگز تغییر نمی‌کند."""
    question = get_owned_question(db, user, payload.question_id)
    if not question.is_active:
        raise HTTPException(status_code=400, detail="این تست آرشیو شده است و قابل حل نیست.")
    result = judge_answer(payload.user_answer, question.correct_answer)
    attempt = QuestionAttempt(
        id=str(uuid4()),
        question_id=question.id,
        user_answer=payload.user_answer,
        result=result,
        spent_seconds=payload.spent_seconds,
        source=payload.source,
    )
    db.add(attempt)
    db.commit()
    db.refresh(attempt)
    index = int(
        db.scalar(
            select(func.count())
            .select_from(QuestionAttempt)
            .where(QuestionAttempt.question_id == question.id)
        )
        or 1
    )
    book = question.book
    base = AttemptOut(
        id=attempt.id,
        question_id=attempt.question_id,
        user_answer=attempt.user_answer,
        result=attempt.result,
        spent_seconds=attempt.spent_seconds,
        attempted_at=attempt.attempted_at,
        source=attempt.source,
        attempt_index=index,
        display_number=question.display_number,
        book_id=question.book_id,
        book_title=book.title if book else None,
        node_title=question.book_node.title if question.book_node else None,
    )
    return AttemptCreated(
        **base.model_dump(),
        correct_answer=question.correct_answer,
        overall=attempt_stats(db, user.id),
        book=attempt_stats(db, user.id, book_id=question.book_id),
        question=attempt_stats(db, user.id, question_id=question.id),
    )
