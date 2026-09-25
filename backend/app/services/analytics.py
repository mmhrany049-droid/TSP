"""محاسبات تحلیلی خالص روی داده‌های خام تلاش و ورودهای پیشین."""
def percentage(correct: int, total: int) -> float:
    return round(correct / total * 100, 1) if total else 0.0

def summarize(results: list[str]) -> dict:
    total = len(results)
    correct = results.count("correct")
    return {"total": total, "correct": correct, "wrong": results.count("wrong"),
            "unanswered": results.count("unanswered"), "accuracy": percentage(correct, total)}
