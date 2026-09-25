from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.database import get_db
from app.models.user import User
from app.schemas.book import (
    BookCreate,
    BookDetail,
    BookNodeCreate,
    BookNodeOut,
    BookNodeUpdate,
    BookOut,
    BookUpdate,
)
from app.schemas.common import Message, Page
from app.services import books as book_service

router = APIRouter(tags=["کتاب‌ها"])


def _pages(total: int, size: int) -> int:
    return 0 if total == 0 else (total + size - 1) // size


@router.get("/books", response_model=Page[BookOut])
def list_books(
    include_archived: bool = False,
    q: str | None = None,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Page[BookOut]:
    """لیست کتاب‌های کاربر. کتاب آرشیوشده به‌طور پیش‌فرض hidden است."""
    items, total = book_service.list_books(
        db,
        current_user,
        include_archived=include_archived,
        query=q,
        page=page,
        size=size,
    )
    return Page(items=items, total=total, page=page, size=size, pages=_pages(total, size))


@router.post("/books", response_model=BookOut, status_code=status.HTTP_201_CREATED)
def create_book(
    payload: BookCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> BookOut:
    """تعریف کتاب تست جدید."""
    book = book_service.create_book(db, current_user, payload)
    return book_service.book_to_out(book)


@router.get("/books/{book_id}", response_model=BookDetail)
def get_book(
    book_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> BookDetail:
    """جزئیات کتاب همراه با درخت ساختار."""
    book, nodes, stats, question_count = book_service.get_book_detail(db, current_user, book_id)
    base = book_service.book_to_out(book, question_count=question_count, stats=stats)
    return BookDetail(**base.model_dump(), nodes=nodes, stats=stats)


@router.patch("/books/{book_id}", response_model=BookOut)
def update_book(
    book_id: str,
    payload: BookUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> BookOut:
    """ویرایش مشخصات کتاب یا بازگرداندن از آرشیو."""
    book = book_service.update_book(db, current_user, book_id, payload)
    return book_service.book_to_out(book)


@router.delete("/books/{book_id}", response_model=Message)
def delete_book(
    book_id: str,
    permanent: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Message:
    """آرشیو کتاب. با permanent=true حذف فیزیکی همراه با ساختار و تست‌ها انجام می‌شود."""
    detail = book_service.delete_book(db, current_user, book_id, permanent=permanent)
    return Message(detail=detail)


@router.post("/books/{book_id}/nodes", response_model=BookNodeOut, status_code=status.HTTP_201_CREATED)
def create_node(
    book_id: str,
    payload: BookNodeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> BookNodeOut:
    """افزودن گره ساختاری مثل فصل، بخش یا آزمون چکاپ."""
    node = book_service.create_node(db, current_user, book_id, payload)
    return book_service.node_to_out(db, node)


@router.patch("/nodes/{node_id}", response_model=BookNodeOut)
def update_node(
    node_id: str,
    payload: BookNodeUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> BookNodeOut:
    """ویرایش عنوان، نوع، ترتیب یا والد گره."""
    node = book_service.update_node(db, current_user, node_id, payload)
    return book_service.node_to_out(db, node)


@router.delete("/nodes/{node_id}", response_model=Message)
def delete_node(
    node_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Message:
    """حذف گره فقط وقتی فرزند یا تست نداشته باشد."""
    return Message(detail=book_service.delete_node(db, current_user, node_id))
