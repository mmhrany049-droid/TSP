"""نرمال‌سازی پاسخ و محاسبه نتیجه. متن سؤال هرگز اینجا ذخیره یا مقایسه نمی‌شود."""

from __future__ import annotations

_DIGIT_MAP = str.maketrans("۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩", "01234567890123456789")
_ARABIC_LETTERS = str.maketrans({"ي": "ی", "ك": "ک", "ة": "ه"})


def normalize_answer(value: str | None) -> str | None:
    """فاصله، ارقام فارسی/عربی و تفاوت ی/ک را برای مقایسه یکسان می‌کند."""
    if value is None:
        return None
    text = value.strip().translate(_DIGIT_MAP).translate(_ARABIC_LETTERS)
    text = text.replace("\u200c", "").replace("\u200d", "")
    text = " ".join(text.split())
    if not text:
        return None
    return text.casefold()


def judge_answer(user_answer: str | None, correct_answer: str) -> str:
    """نتیجه را فقط از مقایسه پاسخ‌ها می‌سازد: correct / wrong / unanswered."""
    normalized_user = normalize_answer(user_answer)
    if normalized_user is None:
        return "unanswered"
    normalized_correct = normalize_answer(correct_answer)
    if normalized_correct is not None and normalized_user == normalized_correct:
        return "correct"
    return "wrong"
