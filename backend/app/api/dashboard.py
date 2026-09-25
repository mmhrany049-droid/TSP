from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.database import get_db
from app.models.user import User
from app.schemas.dashboard import DashboardSummary
from app.services.dashboard import summary

router = APIRouter(prefix="/dashboard", tags=["داشبورد"])


@router.get("/summary", response_model=DashboardSummary)
def dashboard_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DashboardSummary:
    """خلاصه عملکرد. درصدها از روی تلاش‌های خام محاسبه می‌شوند."""
    return summary(db, current_user)
