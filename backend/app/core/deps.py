from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import User
from .security import decode_token
bearer = HTTPBearer(auto_error=False)
def current_user(credentials: HTTPAuthorizationCredentials | None = Depends(bearer), db: Session = Depends(get_db)) -> User:
    if not credentials: raise HTTPException(401, "برای ادامه وارد حساب خود شوید")
    user_id = decode_token(credentials.credentials)
    user = db.get(User, user_id) if user_id else None
    if not user: raise HTTPException(401, "نشست شما معتبر نیست؛ دوباره وارد شوید")
    return user
