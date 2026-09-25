from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.database import get_db
from app.models.user import User
from app.schemas.common import Page
from app.schemas.question import QuestionCreate, QuestionOut, QuestionUpdate
from app.services import questions as question_service
from app.services.access import get_owned_question

router = APIRouter(prefix="/questions", tags=["تست‌ها"])


def _pages(total: int, size: int) -> int:
    return 0 if total == 0 else (total + size - 1) // size


@router.get("", response_model=Page[QuestionOut])
def list_questions(
    book_id: str | None = None,
    book_node_id: str | None = None,
    is_important: bool | None = None,
    is_hard: bool | None = None,
    is_active: bool | None = None,
    include_inactive: bool = False,
    q: str | None = None,
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Page[QuestionOut]:
    """لیست تست‌ها. شماره نمایشی فیلتر یکتایی نیست و فقط برای جستجو استفاده می‌شود."""
    items, total = question_service.list_questions(
        db,
        current_user,
        book_id=book_id,
        book_node_id=book_node_id,
        is_important=is_important,
        is_hard=is_hard,
        is_active=is_active,
        include_inactive=include_inactive,
        query=q,
        page=page,
        size=size,
    )
    return Page(items=items, total=total, page=page, size=size, pages=_pages(total, size))


@router.post("", response_model=QuestionOut, status_code=status.HTTP_201_CREATED)
def create_question(
    payload: QuestionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> QuestionOut:
    """ثبت تست فقط با شماره نمایشی و پاسخ صحیح. متن سؤال ذخیره نمی‌شود."""
    question = question_service.create_question(db, current_user, payload)
    return question_service.to_out(db, question, include_path=True)


@router.get("/{question_id}", response_model=QuestionOut)
def get_question(
    question_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> QuestionOut:
    """جزئیات یک تست با شناسه داخلی."""
    question = get_owned_question(db, current_user, question_id)
    return question_service.to_out(db, question, include_path=True)


@router.patch("/{question_id}", response_model=QuestionOut)
def update_question(
    question_id: str,
    payload: QuestionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> QuestionOut:
    """ویرایش شماره، پاسخ صحیح، علامت مهم/سخت یا آرشیو. تلاش‌های قبلی تغییر نمی‌کنند."""
    question = question_service.update_question(db, current_user, question_id, payload)
    return question_service.to_out(db, question, include_path=True)
