from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import hash_password, verify_password, verify_password_dummy
from app.models.user import User
from app.schemas.auth import RegisterRequest


def register_user(db: Session, payload: RegisterRequest) -> User:
    existing = db.scalar(select(User).where(User.email == payload.email))
    if existing is not None:
        raise HTTPException(status_code=409, detail="امکان ثبت‌نام با این ایمیل وجود ندارد.")
    user = User(
        id=str(uuid4()),
        email=payload.email,
        name=payload.name,
        password_hash=hash_password(payload.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def authenticate(db: Session, email: str, password: str) -> User:
    invalid = HTTPException(status_code=401, detail="ایمیل یا رمز عبور نادرست است.")
    user = db.scalar(select(User).where(User.email == email))
    if user is None:
        verify_password_dummy(password)
        raise invalid
    if not verify_password(password, user.password_hash):
        raise invalid
    return user
