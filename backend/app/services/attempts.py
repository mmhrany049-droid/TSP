"""منطق ثبت نتیجه تلاش؛ این لایه هیچ متنی از سؤال دریافت یا ذخیره نمی‌کند."""
def calculate_result(user_answer: str | None, correct_answer: str | None) -> str:
    if user_answer is None or not user_answer.strip():
        return "unanswered"
    return "correct" if user_answer.strip().casefold() == (correct_answer or "").strip().casefold() else "wrong"
