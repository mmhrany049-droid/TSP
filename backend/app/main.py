import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from starlette.exceptions import HTTPException as StarletteHTTPException

from app import models  # noqa: F401
from app.api import attempts, auth, books, dashboard, questions
from app.config import get_settings
from app.database import get_db
from fastapi import Depends

logger = logging.getLogger("tsp")
settings = get_settings()

app = FastAPI(
    title="TSP API",
    description="سامانه مدیریت تست، مطالعه و آمادگی آزمون — نسخه اول قابل تست",
    version="0.3.1",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_origin_regex=settings.cors_origin_regex or None,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _persian_validation_message(exc: RequestValidationError) -> str:
    messages: list[str] = []
    for error in exc.errors():
        raw = str(error.get("msg", ""))
        if raw.startswith("Value error, "):
            raw = raw[len("Value error, ") :]
        loc = error.get("loc") or ()
        field = str(loc[-1]) if loc else ""
        if any("\u0600" <= char <= "\u06ff" for char in raw):
            text_message = raw
        elif field in {"email", "password", "name"}:
            text_message = {
                "email": "ایمیل معتبر نیست.",
                "password": "رمز عبور معتبر نیست.",
                "name": "نام معتبر نیست.",
            }[field]
        else:
            text_message = "داده‌های ورودی نامعتبر است."
        if text_message not in messages:
            messages.append(text_message)
    return " ".join(messages) if messages else "داده‌های ورودی نامعتبر است."


_ENGLISH_HTTP = {
    "Not Found": "مسیر یا منبع پیدا نشد.",
    "Method Not Allowed": "این عملیات مجاز نیست.",
    "Internal Server Error": "خطای داخلی سرور رخ داد.",
    "Unauthorized": "برای دسترسی باید وارد شوید.",
}


@app.exception_handler(StarletteHTTPException)
async def starlette_http_handler(_request: Request, exc: StarletteHTTPException) -> JSONResponse:
    detail = exc.detail if isinstance(exc.detail, str) else "خطا در پردازش درخواست."
    detail = _ENGLISH_HTTP.get(detail, detail)
    return JSONResponse(status_code=exc.status_code, content={"detail": detail}, headers=exc.headers)


@app.exception_handler(RequestValidationError)
async def validation_handler(_request: Request, exc: RequestValidationError) -> JSONResponse:
    return JSONResponse(status_code=422, content={"detail": _persian_validation_message(exc)})


@app.exception_handler(IntegrityError)
async def integrity_handler(_request: Request, exc: IntegrityError) -> JSONResponse:
    logger.info("integrity error: %s", exc.__class__.__name__)
    return JSONResponse(status_code=409, content={"detail": "این عملیات با داده‌های موجود تعارض دارد."})


@app.exception_handler(Exception)
async def unhandled_handler(_request: Request, exc: Exception) -> JSONResponse:
    logger.exception("unhandled error")
    return JSONResponse(status_code=500, content={"detail": "خطای داخلی سرور رخ داد."})


@app.get("/", tags=["سلامت"])
def root() -> dict[str, str]:
    """راهنمای کوتاه برای کسی که ریشه سرویس را باز می‌کند."""
    return {
        "detail": "سرویس TSP آماده است. رابط کاربری روی پورت ۳۰۰۰ است.",
        "health": "/health",
        "docs": "/docs",
        "api": "/api/v1",
    }


@app.get("/health", tags=["سلامت"])
def health(db: Session = Depends(get_db)) -> dict[str, str]:
    """بررسی سلامت سرویس و اتصال پایگاه داده."""
    db.execute(text("SELECT 1"))
    return {"status": "ok", "database": "ok"}


@app.get("/api/v1/health", tags=["سلامت"])
def health_v1(db: Session = Depends(get_db)) -> dict[str, str]:
    """همان بررسی سلامت، زیر پیشوند API."""
    return health(db)


api_prefix = "/api/v1"
app.include_router(auth.router, prefix=api_prefix)
app.include_router(books.router, prefix=api_prefix)
app.include_router(questions.router, prefix=api_prefix)
app.include_router(attempts.router, prefix=api_prefix)
app.include_router(dashboard.router, prefix=api_prefix)
