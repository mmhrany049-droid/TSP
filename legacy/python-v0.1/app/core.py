"""ابزارهای مشترک: خطاها، اعتبارسنجی، تاریخ/ساعت و صفحه‌بندی."""
from __future__ import annotations

import re
from datetime import date, datetime, timedelta, timezone
from typing import Any, Iterable

from .jalali import format_jalali, jalali_to_gregorian

QUESTION_CODE_RE = re.compile(r"^[A-Za-z][A-Za-z0-9]*-\d{3,}$")
_JALALI_RE = re.compile(r"^(\d{4})[/-](\d{1,2})[/-](\d{1,2})")


class ApiError(Exception):
    """خطای قابل نمایش به کاربر با کد وضعیت HTTP."""

    def __init__(self, message: str, status: int = 400, errors: dict | None = None):
        super().__init__(message)
        self.message = message
        self.status = status
        self.errors = errors or {}

    def to_dict(self) -> dict:
        payload = {"error": self.message, "status": self.status}
        if self.errors:
            payload["errors"] = self.errors
        return payload


class NotFound(ApiError):
    def __init__(self, message: str = "مورد درخواستی یافت نشد"):
        super().__init__(message, status=404)


class Conflict(ApiError):
    def __init__(self, message: str):
        super().__init__(message, status=409)


# ---------------------------------------------------------------------------
# اعتبارسنجی ورودی
# ---------------------------------------------------------------------------

def require(data: dict, fields: Iterable[str]) -> None:
    missing = {f: "این فیلد الزامی است" for f in fields
               if data.get(f) in (None, "", [])}
    if missing:
        raise ApiError("اطلاعات ناقص است", 422, missing)


def clean(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def as_int(value: Any, field: str = "مقدار", allow_none: bool = False) -> int | None:
    if value is None or value == "":
        if allow_none:
            return None
        raise ApiError("مقدار عددی نامعتبر است", 422, {field: "عدد لازم است"})
    try:
        return int(value)
    except (TypeError, ValueError):
        try:
            return int(float(value))
        except (TypeError, ValueError):
            raise ApiError("مقدار عددی نامعتبر است", 422,
                           {field: "عدد صحیح لازم است"})


def as_float(value: Any, field: str = "مقدار", allow_none: bool = True) -> float | None:
    if value is None or value == "":
        if allow_none:
            return None
        raise ApiError("مقدار عددی نامعتبر است", 422, {field: "عدد لازم است"})
    try:
        return float(value)
    except (TypeError, ValueError):
        raise ApiError("مقدار عددی نامعتبر است", 422, {field: "عدد لازم است"})


def as_bool(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if value is None:
        return False
    return str(value).strip().lower() in ("1", "true", "yes", "on", "بله", "true")


def as_choice(value: Any, choices: list[str], field: str, allow_none: bool = True,
              default: str | None = None) -> str | None:
    if value in (None, ""):
        if allow_none:
            return default
        raise ApiError("انتخاب الزامی است", 422, {field: "این فیلد الزامی است"})
    text = str(value).strip()
    if text not in choices:
        raise ApiError("مقدار نامعتبر است", 422,
                       {field: f"یکی از مقادیر مجاز: {', '.join(choices)}"})
    return text


def as_id(value: Any, field: str = "شناسه") -> int | None:
    if value in (None, "", "null", "None"):
        return None
    return as_int(value, field, allow_none=True)


# ---------------------------------------------------------------------------
# تاریخ و ساعت  (پشتیبانی هم‌زمان از ورودی شمسی و میلادی)
# ---------------------------------------------------------------------------

def parse_when(value: Any, *, required: bool = True,
               default_now: bool = True) -> str | None:
    """تبدیل ورودی تاریخ/ساعت کاربر به ISO-8601 با پسوند Z.

    ورودی‌های پذیرفته‌شده:
      1404/06/31            (شمسی، تاریخ)
      1404/06/31 14:30
      1404-06-31T14:30
      2026-09-22
      2026-09-22T14:30
      2026-09-22T14:30:00Z
      «اکنون» / now
    """
    if value in (None, "", "null"):
        if not required:
            return None
        if default_now:
            return now_iso()
        raise ApiError("تاریخ الزامی است", 422, {"attempted_at": "تاریخ لازم است"})
    text = str(value).strip()
    if text in ("now", "اکنون", "الان"):
        return now_iso()

    jal = _JALALI_RE.match(text.replace("T", " "))
    if jal:
        jy, jm, jd = (int(g) for g in jal.groups())
        gdate = jalali_to_gregorian(jy, jm, jd)
        return _combine(gdate, _time_part(text)) 

    normalized = text.replace(" ", "T")
    if normalized.endswith("Z"):
        normalized = normalized[:-1] + "+00:00"
    try:
        dt = datetime.fromisoformat(normalized)
    except ValueError:
        raise ApiError("قالب تاریخ نامعتبر است", 422,
                       {"date": "نمونه معتبر: 1404/06/31 14:30 یا 2026-09-22T14:30"})
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _time_part(text: str) -> tuple[int, int, int]:
    match = re.search(r"[T ](\d{1,2}):(\d{2})(?::(\d{2}))?", text)
    if not match:
        return 0, 0, 0
    return (int(match.group(1)), int(match.group(2)), int(match.group(3) or 0))


def _combine(gdate: date, time_parts: tuple[int, int, int]) -> str:
    hh, mm, ss = time_parts
    dt = datetime(gdate.year, gdate.month, gdate.day, hh, mm, ss, tzinfo=timezone.utc)
    return dt.isoformat().replace("+00:00", "Z")


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def parse_date_only(value: Any, required: bool = False) -> str | None:
    when = parse_when(value, required=required, default_now=False)
    return when[:10] if when else None


def day_range(days: int) -> tuple[str, str]:
    end = datetime.now(timezone.utc).date()
    start = end - timedelta(days=max(days, 1) - 1)
    return start.isoformat(), (end + timedelta(days=1)).isoformat()


# ---------------------------------------------------------------------------
# کمکی‌های متن و صفحه‌بندی
# ---------------------------------------------------------------------------

def like_pattern(term: str) -> str:
    safe = term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    return f"%{safe}%"


def paginate(items: list, page: int = 1, page_size: int = 50, total: int | None = None) -> dict:
    page = max(1, page)
    page_size = min(max(page_size, 1), 500)
    return {
        "items": items,
        "page": page,
        "page_size": page_size,
        "total": total if total is not None else len(items),
    }


def human_when(value: str | None) -> str:
    """نمایش تاریخ شمسی همراه ساعت برای رابط کاربری."""
    if not value:
        return "—"
    text = format_jalali(value)
    if "T" in value:
        return f"{text} — {value[11:16]}"
    return text
