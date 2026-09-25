from pydantic import BaseModel, EmailStr, Field, field_validator

from app.schemas.common import Timestamped


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)
    name: str | None = Field(default=None, max_length=120)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: EmailStr) -> str:
        return str(value).strip().lower()

    @field_validator("name")
    @classmethod
    def normalize_name(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        return cleaned or None

    @field_validator("password")
    @classmethod
    def password_rules(cls, value: str) -> str:
        if len(value) < 8:
            raise ValueError("رمز عبور باید حداقل ۸ کاراکتر باشد.")
        if len(value.encode("utf-8")) > 72:
            raise ValueError("رمز عبور بیش از حد طولانی است.")
        return value


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: EmailStr) -> str:
        return str(value).strip().lower()


class UserOut(Timestamped):
    id: str
    email: str
    name: str | None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut
