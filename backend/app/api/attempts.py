from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.database import get_db
from app.models.user import User
from app.schemas.attempt import AttemptCreate, AttemptCreated, AttemptOut
from app.schemas.common import Page
from app.services import attempts as attempt_service

router = APIRouter(prefix="/attempts", tags=["تلاش‌ها"])


def _pages(total: int, size: int) -> int:
    return 0 if total == 0 else (total + size - 1) // size


@router.post("", response_model=AttemptCreated, status_code=status.HTTP_201_CREATED)
def create_attempt(
    payload: AttemptCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AttemptCreated:
    """ثبت تلاش جدید. نتیجه را سرور حساب می‌کند و رکورد قبلی را هرگز بازنویسی نمی‌کند."""
    return attempt_service.create_attempt(db, current_user, payload)


@router.get("", response_model=Page[AttemptOut])
def list_attempts(
    question_id: str | None = None,
    book_id: str | None = None,
    result: str | None = None,
    source: str | None = None,
    attempted_from: datetime | None = Query(None, alias="from"),
    attempted_to: datetime | None = Query(None, alias="to"),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Page[AttemptOut]:
    """تاریخچه تلاش‌ها. هر ردیف یک حل مستقل است."""
    items, total = attempt_service.list_attempts(
        db,
        current_user,
        question_id=question_id,
        book_id=book_id,
        result=result,
        source=source,
        attempted_from=attempted_from,
        attempted_to=attempted_to,
        page=page,
        size=size,
    )
    return Page(items=items, total=total, page=page, size=size, pages=_pages(total, size))


@router.api_route("/{attempt_id}", methods=["PUT", "PATCH", "DELETE"], status_code=405)
def reject_attempt_mutation(
    attempt_id: str,
    _current_user: User = Depends(get_current_user),
) -> None:
    """تلاش ثبت‌شده قابل تغییر نیست؛ هر حل باید رکورد جدید بسازد."""
    raise HTTPException(
        status_code=405,
        detail="تلاش‌های ثبت‌شده قابل ویرایش یا حذف نیستند. هر حل یک رکورد جدید است.",
    )
