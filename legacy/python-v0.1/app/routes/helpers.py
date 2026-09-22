"""کمکی‌های مشترک ماژول‌های مسیر."""
from __future__ import annotations

from ..core import ApiError
from ..server import Request


def body(request: Request) -> dict:
    if not isinstance(request.body, dict):
        raise ApiError("بدنه درخواست باید JSON باشد", 400)
    return request.body


def id_param(request: Request, name: str = "id") -> int:
    raw = request.params.get(name)
    try:
        return int(raw)
    except (TypeError, ValueError):
        raise ApiError(f"شناسه نامعتبر: {raw}", 422, {name: "عدد صحیح لازم است"})


def page_args(request: Request) -> dict:
    return {
        "page": request.q_int("page", 1) or 1,
        "page_size": request.q_int("page_size", 50) or 50,
    }


def text_field(request: Request, *names: str) -> str | None:
    for name in names:
        value = request.body.get(name) if isinstance(request.body, dict) else None
        if value not in (None, ""):
            return value
    return None


def uploaded_bytes(request: Request) -> tuple[bytes, str, str]:
    """اولین فایل ارسالی را برمی‌گرداند: (داده، نام، نوع)."""
    if request.files:
        item = request.files[0]
        return item.data, item.filename, item.content_type
    text = text_field(request, "text", "csv")
    if text:
        return str(text).encode("utf-8"), "upload.csv", "text/csv"
    raise ApiError("فایلی ارسال نشده است", 422, {"file": "الزامی"})
