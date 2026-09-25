from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.core.security import create_access_token
from app.database import get_db
from app.models.user import User
from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse, UserOut
from app.services.auth import authenticate, register_user

router = APIRouter(prefix="/auth", tags=["احراز هویت"])


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, db: Session = Depends(get_db)) -> User:
    """ثبت‌نام کاربر جدید با ایمیل و رمز عبور."""
    return register_user(db, payload)


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    """ورود و دریافت توکن JWT."""
    user = authenticate(db, payload.email, payload.password)
    return TokenResponse(access_token=create_access_token(user.id), token_type="bearer", user=UserOut.model_validate(user))


@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)) -> User:
    """اطلاعات کاربر جاری."""
    return current_user
