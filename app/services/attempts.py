"""ماژول ۴ — ثبت سابقه تست.

قاعده ۷: هر بار حل، یک QuestionAttempt جدید می‌سازد و رکورد قبلی دست‌نخورده می‌ماند.
قاعده ۸: ورود تست‌های «قبلاً حل‌شده» (PreviousQuestionEntry) با تلاش عادی یکی نیست و
          تاریخ/زمان هم برای آن اجباری نیست.
"""
from __future__ import annotations

import re
from typing import Any

from ..config import ATTEMPT_SOURCES, RESULTS
from ..core import (ApiError, NotFound, as_choice, as_id, as_int, clean, like_pattern,
                    paginate, parse_when, require)
from ..db import Database, dumps, utc_now

_ANSWER_CLEAN_RE = re.compile(r"[\s\u200c.,؟?«»\"']+")


def normalize_answer(value: Any) -> str | None:
    """نرمال‌سازی پاسخ برای مقایسه: حذف فاصله، نقطه، علامت سؤال و بزرگی/کوچکی حرف."""
    text = clean(value)
    if text is None:
        return None
    text = text.replace("ي", "ی").replace("ك", "ک")
    text = _ANSWER_CLEAN_RE.sub("", text)
    return text.lower()


def compare_answer(user_answer: Any, correct_answer: Any) -> str:
    """نتیجه مقایسه پاسخ کاربر با پاسخ صحیح (درست/غلط/بی‌پاسخ)."""
    user = normalize_answer(user_answer)
    if user is None:
        return "unanswered"
    correct = normalize_answer(correct_answer)
    if correct is None:
        raise ApiError("این تست پاسخ صحیح ثبت‌شده ندارد؛ ابتدا کلید تست را وارد کنید",
                       422, {"correct_answer": "کلید تست ثبت نشده است"})
    if user == correct:
        return "correct"
    # پشتیبانی از چند گزینه صحیح مانند «1,3» یا «1 و 3»
    correct_parts = {normalize_answer(p) for p in re.split(r"[,،و+]+", str(correct_answer))}
    correct_parts.discard(None)
    if user in correct_parts:
        return "correct"
    return "incorrect"


# ---------------------------------------------------------------------------
# تلاش جدید
# ---------------------------------------------------------------------------

def record_attempt(db: Database, data: dict, *, source: str = "app",
                   exam_attempt_id: int | None = None,
                   sync_review: bool = True) -> dict:
    """ثبت یک تلاش جدید. همیشه رکورد تازه درج می‌شود (قاعده ۷)."""
    question = _resolve_question(db, data)
    user_answer = clean(data.get("user_answer"))
    result = _resolve_result(data, user_answer, question["correct_answer"])
    spent_seconds = _parse_seconds(data.get("spent_seconds"))
    attempted_at = parse_when(data.get("attempted_at"), required=True)
    source = as_choice(data.get("source") or source, ATTEMPT_SOURCES, "source",
                       allow_none=True, default=source)
    with db.write() as cur:
        cur.execute(
            """INSERT INTO question_attempt(question_id, user_answer, result, spent_seconds,
                                            attempted_at, source, exam_attempt_id, notes,
                                            created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (question["id"], user_answer, result, spent_seconds, attempted_at, source,
             exam_attempt_id, clean(data.get("notes")), utc_now()),
        )
        attempt_id = int(cur.lastrowid)
    if sync_review:
        from .review import sync_question_review
        sync_question_review(db, question["id"])
    from .analytics import log_activity
    log_activity(db, "attempt", "question", question["id"],
                 f"ثبت تلاش برای تست {question['code']}")
    return get_attempt(db, attempt_id)


def record_many_attempts(db: Database, rows: list[dict], default_when: str | None = None,
                         source: str = "app") -> dict:
    """ثبت گروهی تلاش‌ها (مناسب ثبت سریع پس از مطالعه)."""
    created: list[dict] = []
    errors: list[dict] = []
    with db.write():
        for index, row in enumerate(rows, start=1):
            try:
                payload = dict(row)
                payload.setdefault("attempted_at", default_when or utc_now())
                created.append(record_attempt(db, payload, source=source,
                                              sync_review=False))
            except ApiError as exc:
                errors.append({"row": index, "error": exc.message,
                               "code": row.get("code") or row.get("question_id")})
        touched = {item["question_id"] for item in created}
    from .review import sync_question_review
    for question_id in touched:
        sync_question_review(db, question_id)
    return {"created": len(created), "skipped": len(errors), "errors": errors,
            "attempts": created}


def get_attempt(db: Database, attempt_id: int) -> dict:
    row = db.query_one(
        """SELECT a.*, q.code, q.display_number, q.correct_answer, b.title AS book_title,
                  bn.title AS node_title
             FROM question_attempt a
             JOIN question q ON q.id = a.question_id
             LEFT JOIN book b ON b.id = q.book_id
             LEFT JOIN book_node bn ON bn.id = q.book_node_id
            WHERE a.id = ?""", (attempt_id,))
    if not row:
        raise NotFound("تلاش یافت نشد")
    return row


def list_attempts(db: Database, question_id: int | None = None, *,
                  subject_id: int | None = None, book_id: int | None = None,
                  result: str | None = None, source: str | None = None,
                  date_from: str | None = None, date_to: str | None = None,
                  include_voided: bool = False, search: str | None = None,
                  page: int = 1, page_size: int = 100) -> list[dict]:
    where = []
    params: list[Any] = []
    if question_id:
        where.append("a.question_id = ?")
        params.append(question_id)
    if book_id:
        where.append("q.book_id = ?")
        params.append(book_id)
    if subject_id:
        where.append("b.subject_id = ?")
        params.append(subject_id)
    if result:
        where.append("a.result = ?")
        params.append(result)
    if source:
        where.append("a.source = ?")
        params.append(source)
    if date_from:
        where.append("a.attempted_at >= ?")
        params.append(date_from)
    if date_to:
        where.append("a.attempted_at < ?")
        params.append(date_to)
    if not include_voided:
        where.append("a.state = 'active'")
    if search:
        like = like_pattern(search)
        where.append("(q.code LIKE ? ESCAPE '\\' OR q.display_number LIKE ? ESCAPE '\\')")
        params.extend([like, like])
    clause = " AND ".join(where) if where else "1=1"
    page = max(1, page)
    page_size = min(max(page_size, 1), 500)
    return db.query(
        f"""SELECT a.*, q.code, q.display_number, q.correct_answer, q.book_id,
                   b.title AS book_title, bn.title AS node_title
              FROM question_attempt a
              JOIN question q ON q.id = a.question_id
              LEFT JOIN book b ON b.id = q.book_id
              LEFT JOIN book_node bn ON bn.id = q.book_node_id
             WHERE {clause}
             ORDER BY a.attempted_at DESC, a.id DESC
             LIMIT ? OFFSET ?""",
        params + [page_size, (page - 1) * page_size])


def void_attempt(db: Database, attempt_id: int, reason: str | None = None) -> dict:
    """بی‌اعتبار کردن اشتباه ورود: رکورد باقی می‌ماند ولی در آمار شمرده نمی‌شود."""
    attempt = get_attempt(db, attempt_id)
    if attempt["state"] == "voided":
        return attempt
    db.update("question_attempt", attempt_id,
              {"state": "voided", "void_reason": clean(reason), "voided_at": utc_now()})
    from .review import sync_question_review
    sync_question_review(db, attempt["question_id"])
    return get_attempt(db, attempt_id)


def restore_attempt(db: Database, attempt_id: int) -> dict:
    attempt = get_attempt(db, attempt_id)
    db.update("question_attempt", attempt_id,
              {"state": "active", "void_reason": None, "voided_at": None})
    from .review import sync_question_review
    sync_question_review(db, attempt["question_id"])
    return get_attempt(db, attempt_id)


def update_attempt_note(db: Database, attempt_id: int, notes: str) -> dict:
    """فقط یادداشت قابل ویرایش است؛ پاسخ/نتیجه/زمان بازنویسی نمی‌شود (قاعده ۷)."""
    get_attempt(db, attempt_id)
    db.update("question_attempt", attempt_id, {"notes": clean(notes)})
    return get_attempt(db, attempt_id)


# ---------------------------------------------------------------------------
# سابقه تست‌های قبلاً حل‌شده (پیش از استفاده از نرم‌افزار)
# ---------------------------------------------------------------------------

def record_previous_entries(db: Database, entries: list[dict],
                            import_label: str | None = None,
                            note: str | None = None,
                            auto_review: bool = True) -> dict:
    """ورود حل‌های قدیمی. تاریخ اجباری نیست (قاعده ۸ و بند ۷-ب سند ۰۱)."""
    if not entries:
        raise ApiError("فهرست ورودی خالی است", 422, {"entries": "حداقل یک سطر لازم است"})
    created: list[dict] = []
    errors: list[dict] = []
    batch_id = _create_batch(db, import_label or "ورود سابقه قبلی", len(entries))
    previous_imported_at = utc_now()  # زمان درج در سیستم (نه لزوماً زمان حل)
    with db.write():
        for index, row in enumerate(entries, start=1):
            try:
                question = _resolve_question(db, row)
                user_answer = clean(row.get("user_answer"))
                result = _resolve_result(row, user_answer, question["correct_answer"])
                imported_at = parse_when(row.get("imported_at") or row.get("attempted_at"),
                                         required=False) or previous_imported_at
                entry_id = db.insert("previous_question_entry", {
                    "question_id": question["id"],
                    "user_answer": user_answer,
                    "result": result,
                    "imported_at": imported_at,
                    "import_batch_id": batch_id,
                    "note": clean(row.get("note") or note),
                    "created_at": utc_now(),
                })
                created.append({"id": entry_id, "question_id": question["id"],
                                "code": question["code"], "result": result,
                                "user_answer": user_answer})
            except ApiError as exc:
                errors.append({"row": index, "error": exc.message,
                               "code": row.get("code") or row.get("question_id")})
    touched = {item["question_id"] for item in created}
    if auto_review:
        from .review import sync_question_review, sync_many
        sync_many(db, touched)
    _update_batch_counts(db, batch_id, {"created": len(created), "skipped": len(errors)},
                         [e["error"] for e in errors])
    return {
        "batch_id": batch_id,
        "created": len(created),
        "skipped": len(errors),
        "errors": errors,
        "entries": created,
        "review_count": sum(1 for item in created if item["result"] != "correct"),
    }


def list_previous_entries(db: Database, question_id: int | None = None, *,
                          result: str | None = None, batch_id: int | None = None,
                          include_voided: bool = False,
                          page: int = 1, page_size: int = 100) -> list[dict]:
    where = []
    params: list[Any] = []
    if question_id:
        where.append("p.question_id = ?")
        params.append(question_id)
    if result:
        where.append("p.result = ?")
        params.append(result)
    if batch_id:
        where.append("p.import_batch_id = ?")
        params.append(batch_id)
    if not include_voided:
        where.append("p.state = 'active'")
    clause = " AND ".join(where) if where else "1=1"
    page = max(1, page)
    page_size = min(max(page_size, 1), 500)
    return db.query(
        f"""SELECT p.*, q.code, q.display_number, q.correct_answer,
                   b.title AS book_title, bn.title AS node_title,
                   ib.label AS batch_label
              FROM previous_question_entry p
              JOIN question q ON q.id = p.question_id
              LEFT JOIN book b ON b.id = q.book_id
              LEFT JOIN book_node bn ON bn.id = q.book_node_id
              LEFT JOIN import_batch ib ON ib.id = p.import_batch_id
             WHERE {clause}
             ORDER BY p.imported_at DESC, p.id DESC
             LIMIT ? OFFSET ?""",
        params + [page_size, (page - 1) * page_size])


def void_previous_entry(db: Database, entry_id: int, reason: str | None = None) -> dict:
    row = db.query_one("SELECT * FROM previous_question_entry WHERE id = ?", (entry_id,))
    if not row:
        raise NotFound("سابقه قبلی یافت نشد")
    db.update("previous_question_entry", entry_id,
              {"state": "voided", "void_reason": clean(reason), "voided_at": utc_now()})
    from .review import sync_question_review
    sync_question_review(db, row["question_id"])
    return {"voided": True, "id": entry_id}


def list_batches(db: Database, kind: str | None = None, limit: int = 50) -> list[dict]:
    sql = "SELECT * FROM import_batch WHERE 1=1"
    params: list[Any] = []
    if kind:
        sql += " AND kind = ?"
        params.append(kind)
    sql += " ORDER BY created_at DESC LIMIT ?"
    params.append(limit)
    rows = db.query(sql, params)
    for row in rows:
        row["counts_parsed"] = _loads_counts(row.get("counts"))
    return rows


# ---------------------------------------------------------------------------
# کمکی‌های داخلی
# ---------------------------------------------------------------------------

def _resolve_question(db: Database, data: dict) -> dict:
    question_id = as_id(data.get("question_id") or data.get("id"), "question_id")
    code = clean(data.get("code"))
    row = None
    if question_id:
        row = db.query_one("SELECT * FROM question WHERE id = ?", (question_id,))
    elif code:
        row = db.query_one("SELECT * FROM question WHERE code = ?", (code,))
    if not row:
        raise NotFound(f"تست با شناسه {question_id or code} یافت نشد")
    if row["state"] != "active":
        raise ApiError("این تست آرشیو شده است و ثبت سابقه جدید برای آن مجاز نیست",
                       409, {"question_id": "تست آرشیوی"})
    return row


def _resolve_result(data: dict, user_answer: str | None, correct_answer: str | None) -> str:
    provided = clean(data.get("result"))
    if provided:
        return as_choice(provided, RESULTS, "result", allow_none=False)
    if user_answer is None:
        return "unanswered"
    return compare_answer(user_answer, correct_answer)


def _parse_seconds(value: Any) -> int | None:
    if value in (None, ""):
        return None
    if isinstance(value, str) and ":" in value:
        parts = [int(as_int(p, "spent_seconds") or 0) for p in value.split(":")]
        seconds = 0
        for part in parts:
            seconds = seconds * 60 + part
        return seconds
    seconds = as_int(value, "spent_seconds", allow_none=True)
    if seconds is not None and seconds < 0:
        raise ApiError("زمان صرف‌شده نمی‌تواند منفی باشد", 422, {"spent_seconds": "نامعتبر"})
    return seconds


def _create_batch(db: Database, label: str, planned: int) -> int:
    return db.insert("import_batch", {
        "kind": "previous_entries",
        "label": label,
        "counts": dumps({"planned": planned}),
        "warnings": dumps([]),
        "created_at": utc_now(),
    })


def _update_batch_counts(db: Database, batch_id: int, counts: dict,
                         warnings: list[str] | None = None) -> None:
    with db.write() as cur:
        cur.execute("UPDATE import_batch SET counts = ?, warnings = ? WHERE id = ?",
                    (dumps(counts), dumps(warnings or []), batch_id))


def _loads_counts(value: str | None) -> dict:
    from ..db import loads
    return loads(value, {}) or {}
