from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.book import Book, BookNode
from app.models.question import Question
from app.models.user import User
from app.schemas.book import BookCreate, BookNodeCreate, BookNodeOut, BookNodeUpdate, BookOut, BookUpdate
from app.schemas.common import StatsOut
from app.services.access import get_owned_book, get_owned_node
from app.services.stats import attempt_stats


def _next_order(db: Session, book_id: str, parent_id: str | None) -> int:
    stmt = select(func.max(BookNode.order_index)).where(BookNode.book_id == book_id)
    if parent_id is None:
        stmt = stmt.where(BookNode.parent_id.is_(None))
    else:
        stmt = stmt.where(BookNode.parent_id == parent_id)
    current = db.scalar(stmt)
    return 0 if current is None else int(current) + 1


def _ensure_parent(db: Session, book_id: str, parent_id: str | None) -> None:
    if parent_id is None:
        return
    parent = db.get(BookNode, parent_id)
    if parent is None or parent.book_id != book_id:
        raise HTTPException(status_code=404, detail="گره والد پیدا نشد.")


def _would_cycle(db: Session, node_id: str, new_parent_id: str | None) -> bool:
    current = new_parent_id
    seen: set[str] = set()
    while current:
        if current == node_id or current in seen:
            return True
        seen.add(current)
        parent = db.get(BookNode, current)
        current = parent.parent_id if parent else None
    return False


def _question_counts(db: Session, book_ids: list[str]) -> dict[str, int]:
    if not book_ids:
        return {}
    rows = db.execute(
        select(Question.book_id, func.count())
        .where(Question.book_id.in_(book_ids), Question.is_active.is_(True))
        .group_by(Question.book_id)
    ).all()
    return {book_id: int(count) for book_id, count in rows}


def _node_question_counts(db: Session, book_id: str) -> dict[str, int]:
    rows = db.execute(
        select(Question.book_node_id, func.count())
        .where(Question.book_id == book_id, Question.is_active.is_(True))
        .group_by(Question.book_node_id)
    ).all()
    return {node_id: int(count) for node_id, count in rows}


def book_to_out(book: Book, *, question_count: int = 0, stats: StatsOut | None = None) -> BookOut:
    return BookOut(
        id=book.id,
        title=book.title,
        subject=book.subject,
        publisher=book.publisher,
        grade=book.grade,
        field=book.field,
        notes=book.notes,
        is_active=book.is_active,
        created_at=book.created_at,
        question_count=question_count,
        attempt_count=0 if stats is None else stats.total,
        percentage=None if stats is None else stats.percentage,
    )


def list_books(
    db: Session,
    user: User,
    *,
    include_archived: bool,
    query: str | None,
    page: int,
    size: int,
) -> tuple[list[BookOut], int]:
    stmt = select(Book).where(Book.user_id == user.id)
    count_stmt = select(func.count()).select_from(Book).where(Book.user_id == user.id)
    if not include_archived:
        stmt = stmt.where(Book.is_active.is_(True))
        count_stmt = count_stmt.where(Book.is_active.is_(True))
    if query:
        like = f"%{query.strip()}%"
        condition = Book.title.ilike(like) | Book.subject.ilike(like) | Book.publisher.ilike(like)
        stmt = stmt.where(condition)
        count_stmt = count_stmt.where(condition)
    total = int(db.scalar(count_stmt) or 0)
    books = list(db.scalars(stmt.order_by(Book.created_at.desc()).offset((page - 1) * size).limit(size)).all())
    counts = _question_counts(db, [book.id for book in books])
    items = []
    for book in books:
        stats = attempt_stats(db, user.id, book_id=book.id)
        items.append(book_to_out(book, question_count=counts.get(book.id, 0), stats=stats))
    return items, total


def create_book(db: Session, user: User, payload: BookCreate) -> Book:
    book = Book(
        id=str(uuid4()),
        user_id=user.id,
        title=payload.title,
        subject=payload.subject,
        publisher=payload.publisher,
        grade=payload.grade,
        field=payload.field or "ریاضی-فیزیک",
        notes=payload.notes,
        is_active=True,
    )
    db.add(book)
    db.commit()
    db.refresh(book)
    return book


def update_book(db: Session, user: User, book_id: str, payload: BookUpdate) -> Book:
    book = get_owned_book(db, user, book_id)
    changes = payload.model_dump(exclude_unset=True)
    for key, value in changes.items():
        setattr(book, key, value)
    db.commit()
    db.refresh(book)
    return book


def delete_book(db: Session, user: User, book_id: str, *, permanent: bool) -> str:
    book = get_owned_book(db, user, book_id)
    if permanent:
        db.delete(book)
        db.commit()
        return "کتاب و ساختار و تست‌های آن برای همیشه حذف شد."
    book.is_active = False
    db.commit()
    return "کتاب آرشیو شد."


def build_tree(nodes: list[BookNode], counts: dict[str, int]) -> list[BookNodeOut]:
    by_parent: dict[str | None, list[BookNode]] = {}
    for node in nodes:
        by_parent.setdefault(node.parent_id, []).append(node)
    for siblings in by_parent.values():
        siblings.sort(key=lambda item: (item.order_index, item.title))

    def walk(parent_id: str | None) -> list[BookNodeOut]:
        result: list[BookNodeOut] = []
        for node in by_parent.get(parent_id, []):
            result.append(
                BookNodeOut(
                    id=node.id,
                    book_id=node.book_id,
                    parent_id=node.parent_id,
                    node_type=node.node_type,
                    title=node.title,
                    order_index=node.order_index,
                    question_count=counts.get(node.id, 0),
                    children=walk(node.id),
                )
            )
        return result

    return walk(None)


def get_book_detail(db: Session, user: User, book_id: str):
    book = get_owned_book(db, user, book_id)
    nodes = list(db.scalars(select(BookNode).where(BookNode.book_id == book.id)).all())
    counts = _node_question_counts(db, book.id)
    stats = attempt_stats(db, user.id, book_id=book.id)
    question_count = int(
        db.scalar(
            select(func.count()).select_from(Question).where(Question.book_id == book.id, Question.is_active.is_(True))
        )
        or 0
    )
    return book, build_tree(nodes, counts), stats, question_count


def create_node(db: Session, user: User, book_id: str, payload: BookNodeCreate) -> BookNode:
    book = get_owned_book(db, user, book_id)
    if not book.is_active:
        raise HTTPException(status_code=400, detail="این کتاب آرشیو شده است.")
    _ensure_parent(db, book.id, payload.parent_id)
    node = BookNode(
        id=str(uuid4()),
        book_id=book.id,
        parent_id=payload.parent_id,
        node_type=payload.node_type,
        title=payload.title,
        order_index=payload.order_index
        if payload.order_index is not None
        else _next_order(db, book.id, payload.parent_id),
    )
    db.add(node)
    db.commit()
    db.refresh(node)
    return node


def update_node(db: Session, user: User, node_id: str, payload: BookNodeUpdate) -> BookNode:
    node = get_owned_node(db, user, node_id)
    changes = payload.model_dump(exclude_unset=True)
    new_parent = changes.get("parent_id", node.parent_id)
    if "parent_id" in changes:
        if new_parent == node.id or _would_cycle(db, node.id, new_parent):
            raise HTTPException(status_code=400, detail="نمی‌توان گره را زیر خودش یا فرزندش منتقل کرد.")
        _ensure_parent(db, node.book_id, new_parent)
    for key, value in changes.items():
        setattr(node, key, value)
    db.commit()
    db.refresh(node)
    return node


def delete_node(db: Session, user: User, node_id: str) -> str:
    node = get_owned_node(db, user, node_id)
    child_count = db.scalar(
        select(func.count()).select_from(BookNode).where(BookNode.parent_id == node.id)
    )
    if child_count:
        raise HTTPException(status_code=400, detail="این گره فرزند دارد. ابتدا فرزندان را حذف کنید.")
    question_count = db.scalar(
        select(func.count()).select_from(Question).where(Question.book_node_id == node.id)
    )
    if question_count:
        raise HTTPException(
            status_code=400,
            detail="این گره تست دارد. ابتدا تست‌ها را به گره دیگری منتقل یا آرشیو و سپس حذف کنید.",
        )
    db.delete(node)
    db.commit()
    return "گره ساختاری حذف شد."


def node_to_out(db: Session, node: BookNode) -> BookNodeOut:
    count = int(
        db.scalar(
            select(func.count())
            .select_from(Question)
            .where(Question.book_node_id == node.id, Question.is_active.is_(True))
        )
        or 0
    )
    return BookNodeOut(
        id=node.id,
        book_id=node.book_id,
        parent_id=node.parent_id,
        node_type=node.node_type,
        title=node.title,
        order_index=node.order_index,
        question_count=count,
        children=[],
    )
