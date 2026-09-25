from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
import logging
from fastapi.middleware.cors import CORSMiddleware
from .config import settings
from .database import Base, engine
from . import models  # noqa: F401 — register SQLAlchemy models
from .api.router import api

app = FastAPI(title="TSP | سامانه تست و آمادگی", version="0.3.0", description="مدیریت مطالعه و آمادگی آزمون")
origins=[origin.strip() for origin in settings.cors_origins.split(",") if origin.strip()]
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
@app.on_event("startup")
def startup():
    Base.metadata.create_all(bind=engine)
@app.exception_handler(RequestValidationError)
async def validation_error_handler(request: Request, exc: RequestValidationError):
    errors=[]
    for e in exc.errors():
        field=" → ".join(str(part) for part in e.get("loc",())[1:])
        errors.append(f"{field}: مقدار واردشده معتبر نیست" if field else "اطلاعات واردشده معتبر نیست")
    return JSONResponse(status_code=422,content={"detail":"؛ ".join(errors) or "اطلاعات واردشده معتبر نیست"})
@app.exception_handler(Exception)
async def unexpected_error_handler(request: Request, exc: Exception):
    logging.getLogger("tsp").exception("Unhandled API error", exc_info=exc)
    return JSONResponse(status_code=500, content={"detail":"خطای پیش‌بینی‌نشده‌ای رخ داد؛ لطفاً دوباره تلاش کنید"})
@app.get("/api/v1/health")
def health(): return {"status":"ok","version":"0.3.0"}
app.include_router(api)
