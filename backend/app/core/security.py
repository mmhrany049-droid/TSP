from datetime import timedelta

import bcrypt
from jose import JWTError, jwt

from app.config import get_settings
from app.utils.time import utcnow

# هش ثابت برای یکسان کردن زمان پاسخ وقتی ایمیل وجود ندارد.
_DUMMY_HASH = bcrypt.hashpw(b"tsp-dummy-password", bcrypt.gensalt())


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain_password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(plain_password.encode("utf-8"), password_hash.encode("utf-8"))
    except ValueError:
        return False


def verify_password_dummy(plain_password: str) -> None:
    """زمان بررسی رمز را حتی اگر کاربر وجود نداشته باشد نزدیک نگه می‌دارد."""
    try:
        bcrypt.checkpw(plain_password.encode("utf-8"), _DUMMY_HASH)
    except ValueError:
        return


def create_access_token(subject: str) -> str:
    settings = get_settings()
    expire = utcnow() + timedelta(minutes=settings.access_token_expire_minutes)
    payload = {"sub": subject, "exp": expire}
    return jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)


def decode_access_token(token: str) -> str | None:
    settings = get_settings()
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
    except JWTError:
        return None
    subject = payload.get("sub")
    if not isinstance(subject, str) or not subject:
        return None
    return subject
