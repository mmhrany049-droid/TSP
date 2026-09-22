"""تبدیل تاریخ شمسی (جلالی) و میلادی.

الگوریتم بر پایه jalaali-js پیاده‌سازی شده است. ذخیره‌سازی در پایگاه داده همیشه
میلادی/ISO است و شمسی فقط برای نمایش و ورود داده استفاده می‌شود.
"""
from __future__ import annotations

from datetime import date, datetime, timedelta

_BREAKS = [-61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635,
           2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178]

PERSIAN_MONTHS = ["فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور",
                  "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"]

PERSIAN_WEEKDAYS = ["شنبه", "یک‌شنبه", "دوشنبه", "سه‌شنبه",
                    "چهارشنبه", "پنج‌شنبه", "جمعه"]


def _div(a: int, b: int) -> int:
    q = abs(a) // abs(b)
    return -q if (a < 0) != (b < 0) else q


def _mod(a: int, b: int) -> int:
    return a - _div(a, b) * b


def _jal_cal(jy: int, without_leap: bool = False):
    bl = len(_BREAKS)
    gy = jy + 621
    leap_j = -14
    jp = _BREAKS[0]
    if jy < jp or jy >= _BREAKS[bl - 1]:
        raise ValueError(f"سال جلالی نامعتبر: {jy}")
    jump = 0
    for i in range(1, bl):
        jm = _BREAKS[i]
        jump = jm - jp
        if jy < jm:
            break
        leap_j += _div(jump, 33) * 8 + _div(_mod(jump, 33), 4)
        jp = jm
    n = jy - jp
    leap_j += _div(n, 33) * 8 + _div(_mod(n, 33) + 3, 4)
    if _mod(jump, 33) == 4 and jump - n == 4:
        leap_j += 1
    leap_g = _div(gy, 4) - _div((_div(gy, 100) + 1) * 3, 4) - 150
    march = 20 + leap_j - leap_g
    if without_leap:
        return gy, march
    if jump - n < 6:
        n = n - jump + _div(jump + 4, 33) * 33
    leap = _mod(_mod(n + 1, 33) - 1, 4)
    if leap == -1:
        leap = 4
    return leap, gy, march


def month_length(jy: int, jm: int) -> int:
    """شمار روزهای یک ماه شمسی."""
    if jm <= 6:
        return 31
    if jm <= 11:
        return 30
    return 30 if is_leap_jalali(jy) else 29


def _day_of_year_offset(jm: int, jd: int) -> int:
    """شماره روز در سال جلالی (صفر-پایه): ۶ ماه اول ۳۱ روز، ۵ ماه ۳۰ روز و اسفند ۲۹/۳۰."""
    return (jm - 1) * 31 - (jm // 7) * (jm - 7) + (jd - 1)


def jalali_to_gregorian(jy: int, jm: int, jd: int) -> date:
    """تبدیل تاریخ شمسی به میلادی (مبنا: اول فروردین همان سال)."""
    if not 1 <= jm <= 12:
        raise ValueError("ماه شمسی باید بین ۱ تا ۱۲ باشد")
    if not 1 <= jd <= 31:
        raise ValueError("روز شمسی باید بین ۱ تا ۳۱ باشد")
    month_limit = month_length(jy, jm)
    if jd > month_limit:
        raise ValueError(f"روز {jd} برای این ماه وجود ندارد (حداکثر {month_limit})")
    gy, march = _jal_cal(jy, without_leap=True)
    first_day = date(gy, 3, march)
    return first_day + timedelta(days=_day_of_year_offset(jm, jd))


def gregorian_to_jalali(value: date) -> tuple[int, int, int]:
    """تبدیل تاریخ میلادی به شمسی."""
    jy = value.year - 621
    gy, march = _jal_cal(jy, without_leap=True)
    first_day = date(gy, 3, march)
    if value < first_day:
        # تاریخ پیش از اول فروردین همان سال جلالی است
        jy -= 1
        gy, march = _jal_cal(jy, without_leap=True)
        first_day = date(gy, 3, march)
    offset = (value - first_day).days
    if offset <= 185:
        jm = offset // 31 + 1
        jd = offset % 31 + 1
    else:
        k = offset - 186
        jm = 7 + k // 30
        jd = k % 30 + 1
    return jy, jm, jd


def is_leap_jalali(jy: int) -> bool:
    """سال کبیسه شمسی (اسفند ۳۰ روز)."""
    return _jal_cal(jy)[0] == 0


def format_jalali(value: date | datetime | str, with_weekday: bool = False) -> str:
    """قالب‌بندی تاریخ میلادی/ISO به شکل «۱۴۰۴/۰۶/۳۱»."""
    d = _as_date(value)
    if d is None:
        return "—"
    jy, jm, jd = gregorian_to_jalali(d)
    text = f"{jy:04d}/{jm:02d}/{jd:02d}"
    if with_weekday:
        # در پایتون، دوشنبه = 0 ؛ در تقویم شمسی شنبه = 0
        weekday = (d.weekday() + 2) % 7
        text = f"{PERSIAN_WEEKDAYS[weekday]} {text}"
    return text


def format_jalali_long(value: date | datetime | str) -> str:
    d = _as_date(value)
    if d is None:
        return "—"
    jy, jm, jd = gregorian_to_jalali(d)
    return f"{jd} {PERSIAN_MONTHS[jm - 1]} {jy}"


def _as_date(value) -> date | None:
    if value is None or value == "":
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    text = str(value).strip()
    if not text:
        return None
    text = text.replace("/", "-")
    for fmt in ("%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M",
                "%Y-%m-%d %H:%M", "%Y-%m-%d"):
        try:
            return datetime.strptime(text[: len(fmt) + 2].strip(), fmt).date()
        except ValueError:
            continue
    try:
        return datetime.fromisoformat(text.replace("Z", "+00:00")).date()
    except ValueError:
        return None


def jalali_today() -> str:
    return format_jalali(date.today())


def jalali_offset(days: int) -> str:
    return format_jalali(date.today() + timedelta(days=days))
