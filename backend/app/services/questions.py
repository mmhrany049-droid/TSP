import re
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.attempt import QuestionAttempt
from app.models.book import BookNode
from app.models.question import Question
from app.models.user import User
from app.schemas.question import NodeBrief, QuestionCreate, QuestionOut, QuestionUpdate
from app.services.access import get_owned_book, get_owned_question
from app.utils.answers import normalize_answer

_DIGIT_MAP = str.maketrans("۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩", "01234567890123456789")


def natural_key(value: str) -> list[tuple[int, object]]:
    normalized = value.translate(_DIGIT_MAP)
    parts = re.split(r"(\d+)", normalized)
    key: list[tuple[int, object]] = []
    for part in parts:
        if not part:
            continue
        if part.isdigit():
            key.append((0, int(part)))
        else:
            key.append((1, part.casefold()))
    return key


def node_path(db: Session, node_id: str) -> list[BookNode]:
    path: list[BookNode] = []
    current = db.get(BookNode, node_id)
    seen: set[str] = set()
    while current is not None and current.id not in seen:
        seen.add(current.id)
        path.append(current)
        current = db.get(BookNode, current.parent_id) if current.parent_id else None
    path.reverse()
    return path


def _summaries(db: Session, question_ids: list[str]) -> dict[str, tuple[int, str | None]]:
    if not question_ids:
        return {}
    counts = {
        question_id: int(count)
        for question_id, count in db.execute(
            select(QuestionAttempt.question_id, func.count())
            .where(QuestionAttempt.question_id.in_(question_ids))
            .group_by(QuestionAttempt.question_id)
        ).all()
    }
    ranked = (
        select(
            QuestionAttempt.question_id.label("question_id"),
            QuestionAttempt.result.label("result"),
            func.row_number()
            .over(
                partition_by=QuestionAttempt.question_id,
                order_by=(QuestionAttempt.attempted_at.desc(), QuestionAttempt.id.desc()),
            )
            .label("rn"),
        )
        .where(QuestionAttempt.question_id.in_(question_ids))
        .subquery()
    )
    latest = {
        question_id: result
        for question_id, result in db.execute(
            select(ranked.c.question_id, ranked.c.result).where(ranked.c.rn == 1)
        ).all()
    }
    return {question_id: (counts.get(question_id, 0), latest.get(question_id)) for question_id in question_ids}


def to_out(
    db: Session,
    question: Question,
    *,
    book_title: str | None = None,
    summaries: dict[str, tuple[int, str | None]] | None = None,
    include_path: bool = False,
) -> QuestionOut:
    summary = (summaries or {}).get(question.id)
    if summary is None and summaries is None:
        summary = _summaries(db, [question.id]).get(question.id, (0, None))
    attempt_count, latest_result = summary or (0, None)
    path = node_path(db, question.book_node_id) if include_path else []
    node = path[-1] if path else db.get(BookNode, question.book_node_id)
    return QuestionOut(
        id=question.id,
        book_id=question.book_id,
        book_node_id=question.book_node_id,
        display_number=question.display_number,
        correct_answer=question.correct_answer,
        publisher_difficulty=question.publisher_difficulty,
        is_important=question.is_important,
        is_hard=question.is_hard,
        is_active=question.is_active,
        created_at=question.created_at,
        book_title=book_title if book_title is not None else (question.book.title if question.book else None),
        node_title=node.title if node else None,
        path=[NodeBrief(id=item.id, title=item.title, node_type=item.node_type) for item in path],
        attempt_count=attempt_count,
        latest_result=latest_result,
    )


def list_questions(
    db: Session,
    user: User,
    *,
    book_id: str | None,
    book_node_id: str | None,
    is_important: bool | None,
    is_hard: bool | None,
    is_active: bool | None,
    include_inactive: bool,
    query: str | None,
    page: int,
    size: int,
) -> tuple[list[QuestionOut], int]:
    if book_id:
        get_owned_book(db, user, book_id)
    if book_node_id:
        node = db.get(BookNode, book_node_id)
        if node is None:
            raise HTTPException(status_code=404, detail="گره ساختاری پیدا نشد.")
        get_owned_book(db, user, node.book_id)

    stmt = select(Question).join(Question.book).where(Question.book.has(user_id=user.id))
    if book_id:
        stmt = stmt.where(Question.book_id == book_id)
    if book_node_id:
        stmt = stmt.where(Question.book_node_id == book_node_id)
    if is_important is not None:
        stmt = stmt.where(Question.is_important.is_(is_important))
    if is_hard is not None:
        stmt = stmt.where(Question.is_hard.is_(is_hard))
    if is_active is None and not include_inactive:
        stmt = stmt.where(Question.is_active.is_(True))
    elif is_active is not None:
        stmt = stmt.where(Question.is_active.is_(is_active))
    if query:
        needle = query.strip()
        if needle:
            stmt = stmt.where(Question.display_number.ilike(f"%{needle}%"))

    rows = list(db.scalars(stmt).all())
    if book_node_id:
        rows.sort(key=lambda item: natural_key(item.display_number))
    else:
        rows.sort(key=lambda item: item.created_at, reverse=True)
    total = len(rows)
    page_rows = rows[(page - 1) * size : page * size]
    summaries = _summaries(db, [item.id for item in page_rows])
    titles = {item.book_id: item.book.title for item in page_rows if item.book is not None}
    return [to_out(db, item, book_title=titles.get(item.book_id), summaries=summaries) for item in page_rows], total


def create_question(db: Session, user: User, payload: QuestionCreate) -> Question:
    book = get_owned_book(db, user, payload.book_id)
    if not book.is_active:
        raise HTTPException(status_code=400, detail="این کتاب آرشیو شده است.")
    node = db.get(BookNode, payload.book_node_id)
    if node is None or node.book_id != book.id:
        raise HTTPException(status_code=404, detail="گره ساختاری این کتاب پیدا نشد.")
    if normalize_answer(payload.correct_answer) is None:
        raise HTTPException(status_code=422, detail="پاسخ صحیح الزامی است.")
    question = Question(
        id=str(uuid4()),
        book_id=book.id,
        book_node_id=node.id,
        display_number=payload.display_number,
        correct_answer=payload.correct_answer,
        publisher_difficulty=payload.publisher_difficulty,
        is_important=payload.is_important,
        is_hard=payload.is_hard,
        is_active=True,
    )
    db.add(question)
    db.commit()
    db.refresh(question)
    return question


def update_question(db: Session, user: User, question_id: str, payload: QuestionUpdate) -> Question:
    question = get_owned_question(db, user, question_id)
    changes = payload.model_dump(exclude_unset=True)
    if "book_node_id" in changes and changes["book_node_id"]:
        node = db.get(BookNode, changes["book_node_id"])
        if node is None or node.book_id != question.book_id:
            raise HTTPException(status_code=404, detail="گره مقصد در همین کتاب پیدا نشد.")
    if "correct_answer" in changes and normalize_answer(changes["correct_answer"]) is None:
        raise HTTPException(status_code=422, detail="پاسخ صحیح الزامی است.")
    for key, value in changes.items():
        setattr(question, key, value)
    db.commit()
    db.refresh(question)
    return question
