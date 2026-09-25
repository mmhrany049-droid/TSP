from datetime import datetime, timedelta, timezone
import hashlib
from jose import jwt, JWTError
import bcrypt
from ..config import settings
ALGORITHM = "HS256"
def _password_bytes(password: str) -> bytes:
    # SHA-256 pre-hashing avoids bcrypt's 72-byte truncation while retaining bcrypt storage.
    return hashlib.sha256(password.encode("utf-8")).hexdigest().encode("ascii")
def hash_password(password: str) -> str:
    return bcrypt.hashpw(_password_bytes(password), bcrypt.gensalt()).decode()
def verify_password(password: str, hashed: str) -> bool:
    try: return bcrypt.checkpw(_password_bytes(password), hashed.encode())
    except (ValueError, TypeError): return False
def create_access_token(subject: str) -> str:
    exp = datetime.now(timezone.utc) + timedelta(minutes=settings.access_token_minutes)
    return jwt.encode({"sub": subject, "exp": exp}, settings.secret_key, algorithm=ALGORITHM)
def decode_token(token: str) -> str | None:
    try: return jwt.decode(token, settings.secret_key, algorithms=[ALGORITHM]).get("sub")
    except JWTError: return None
