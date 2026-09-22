"""ماژول ۷ و ۸ — مدیریت آزمون و سوابق آزمون.

قاعده ۹: Exam تعریف آزمون است و ExamAttempt اجرای آن؛ یک Exam می‌تواند چند
اجرای مستقل داشته باشد و پاسخ‌های هر اجرا جدا ذخیره می‌شود.
"""
from __future__ import annotations

import json
from typing import Any

from ..config import EXAM_STATES, EXAM_TYPES
from ..core import (ApiError, Conflict, NotFound, as_choice, as_float, as_id, as_int,
                    clean, like_pattern, paginate, parse_date_only, parse_when, require)
from ..db import Database, dumps, loads, placeholders, utc_now
from .attempts import compare_answer, normalize_answer
from .topics import subtree_ids, topic_path


# ---------------------------------------------------------------------------
# تعریف آزمون
# ---------------------------------------------------------------------------

def _exam_row(db: Database, exam_id: int) -> dict:
    row = db.query_one("SELECT * FROM exam WHERE id = ?", (exam_id,))
    if not row:
        raise NotFound("آزمون یافت نشد")
    return row


def list_exams(db: Database, *, subject_id: int | None = None, status: str | None = None,
               exam_type: str | None = None, upcoming_only: bool = False,
               search: str | None = None, page: int = 1, page_size: int = 50) -> dict:
    where = []
    params: list[Any] = []
    if subject_id:
        where.append("e.subject_id = ?")
        params.append(subject_id)
    if status:
        where.append("e.status = ?")
        params.append(status)
    if exam_type:
        where.append("e.exam_type = ?")
        params.append(exam_type)
    if upcoming_only:
        where.append("e.planned_date IS NOT NULL AND e.planned_date >= date('now')")
    if search:
        where.append("e.title LIKE ? ESCAPE '\\'")
        params.append(like_pattern(search))
    clause = " AND ".join(where) if where else "1=1"
    total = db.scalar(f"SELECT COUNT(*) FROM exam e WHERE {clause}", params, 0) or 0
    page = max(1, page)
    page_size = min(max(page_size, 1), 200)
    rows = db.query(
        f"""SELECT e.*, s.name AS subject_name,
                   (SELECT COUNT(*) FROM exam_question eq WHERE eq.exam_id = e.id)
                       AS question_count,
                   (SELECT COUNT(*) FROM exam_topic et WHERE et.exam_id = e.id)
                       AS topic_count,
                   (SELECT COUNT(*) FROM exam_attempt ea WHERE ea.exam_id = e.id)
                       AS attempt_count,
                   (SELECT MAX(ea.finished_at) FROM exam_attempt ea
                     WHERE ea.exam_id = e.id AND ea.state='finished') AS last_attempt_at,
                   (SELECT ea.score_percent FROM exam_attempt ea
                     WHERE ea.exam_id = e.id AND ea.state='finished'
                     ORDER BY ea.finished_at DESC LIMIT 1) AS last_score,
                   (SELECT COUNT(*) FROM exam_asset asx WHERE asx.exam_id = e.id) AS asset_count
              FROM exam e LEFT JOIN subject s ON s.id = e.subject_id
             WHERE {clause}
             ORDER BY IFNULL(e.planned_date, '9999-12-31'), e.id DESC
             LIMIT ? OFFSET ?""",
        params + [page_size, (page - 1) * page_size])
    return paginate(rows, page, page_size, total)


def get_exam(db: Database, exam_id: int) -> dict:
    exam = db.query_one(
        """SELECT e.*, s.name AS subject_name FROM exam e
           LEFT JOIN subject s ON s.id = e.subject_id WHERE e.id = ?""", (exam_id,))
    if not exam:
        raise NotFound("آزمون یافت نشد")
    exam["topics"] = db.query(
        """SELECT t.id, t.title, et.weight FROM exam_topic et
             JOIN topic t ON t.id = et.topic_id WHERE et.exam_id = ?
            ORDER BY t.order_index""", (exam_id,))
    for topic in exam["topics"]:
        topic["path"] = topic_path(db, topic["id"])
    exam["questions"] = db.query(
        """SELECT eq.*, q.code, q.display_number AS bank_display_number,
                  q.publisher_difficulty, t.title AS topic_title,
                  bn.title AS node_title, b.title AS book_title
             FROM exam_question eq
             LEFT JOIN question q ON q.id = eq.question_id
             LEFT JOIN topic t ON t.id = eq.topic_id
             LEFT JOIN book_node bn ON bn.id = q.book_node_id
             LEFT JOIN book b ON b.id = q.book_id
            WHERE eq.exam_id = ? ORDER BY eq.order_index, eq.id""", (exam_id,))
    exam["assets"] = list_assets(db, exam_id)
    exam["attempts"] = list_attempts(db, exam_id)
    if exam.get("book_node_id"):
        from .resources import node_path
        exam["book_node_path"] = node_path(db, exam["book_node_id"])
    exam["summary"] = exam_summary(db, exam_id)
    return exam


def create_exam(db: Database, data: dict) -> dict:
    require(data, ["title"])
    payload = {
        "title": clean(data["title"]),
        "exam_type": as_choice(data.get("exam_type"), EXAM_TYPES, "exam_type",
                               allow_none=True, default="single_subject"),
        "subject_id": as_id(data.get("subject_id"), "subject_id"),
        "planned_date": parse_date_only(data.get("planned_date") or data.get("date")),
        "notes": clean(data.get("notes")),
        "status": as_choice(data.get("status"), EXAM_STATES, "status", allow_none=True,
                            default="planned"),
        "book_node_id": as_id(data.get("book_node_id"), "book_node_id"),
        "created_at": utc_now(),
    }
    exam_id = db.insert("exam", payload)
    if data.get("topic_ids"):
        set_topics(db, exam_id, [{"topic_id": t} for t in data["topic_ids"]])
    return get_exam(db, exam_id)


def update_exam(db: Database, exam_id: int, data: dict) -> dict:
    _exam_row(db, exam_id)
    updates: dict[str, Any] = {}
    if "title" in data:
        title = clean(data["title"])
        if not title:
            raise ApiError("عنوان آزمون نمی‌تواند خالی باشد", 422, {"title": "الزامی"})
        updates["title"] = title
    if "exam_type" in data:
        updates["exam_type"] = as_choice(data["exam_type"], EXAM_TYPES, "exam_type",
                                        allow_none=False)
    if "status" in data:
        updates["status"] = as_choice(data["status"], EXAM_STATES, "status",
                                      allow_none=False)
    if "subject_id" in data:
        updates["subject_id"] = as_id(data["subject_id"], "subject_id")
    if "notes" in data:
        updates["notes"] = clean(data["notes"])
    if "planned_date" in data or "date" in data:
        updates["planned_date"] = parse_date_only(data.get("planned_date") or data.get("date"))
    if updates:
        db.update("exam", exam_id, updates)
    return get_exam(db, exam_id)


def delete_exam(db: Database, exam_id: int) -> dict:
    """آزمون فقط آرشیو می‌شود تا سوابق اجراها حفظ شوند (قاعده ۹)."""
    _exam_row(db, exam_id)
    attempts = db.scalar("SELECT COUNT(*) FROM exam_attempt WHERE exam_id = ?", (exam_id,), 0)
    db.execute("UPDATE exam SET status='archived' WHERE id = ?", (exam_id,))
    return {"archived": True, "attempts_kept": attempts,
            "note": "سوابق اجراهای آزمون حفظ شده است"}


def set_topics(db: Database, exam_id: int, topics: list[dict]) -> dict:
    _exam_row(db, exam_id)
    normalized: list[tuple[int, float]] = []
    for row in topics:
        topic_id = as_id(row.get("topic_id"), "topic_id")
        if not topic_id:
            continue
        if not db.scalar("SELECT 1 FROM topic WHERE id = ?", (topic_id,)):
            raise NotFound(f"مبحث {topic_id} یافت نشد")
        normalized.append((topic_id, as_float(row.get("weight"), "weight") or 1.0))
    with db.write() as cur:
        cur.execute("DELETE FROM exam_topic WHERE exam_id = ?", (exam_id,))
        for topic_id, weight in normalized:
            cur.execute("INSERT INTO exam_topic(exam_id, topic_id, weight) VALUES (?, ?, ?)",
                        (exam_id, topic_id, weight))
    return get_exam(db, exam_id)


# ---------------------------------------------------------------------------
# سؤال‌های آزمون
# ---------------------------------------------------------------------------

def add_questions(db: Database, exam_id: int, questions: list[dict]) -> dict:
    """افزودن سؤال به آزمون؛ از بانک تست یا سؤال دستی (بدون question_id)."""
    _exam_row(db, exam_id)
    if not questions:
        raise ApiError("فهرست سؤال‌ها خالی است", 422, {"questions": "حداقل یک سؤال لازم است"})
    created, skipped = 0, []
    order_start = db.scalar("SELECT IFNULL(MAX(order_index), 0) FROM exam_question "
                            "WHERE exam_id = ?", (exam_id,), 0) or 0
    with db.write() as cur:
        for index, row in enumerate(questions, start=1):
            question_id = as_id(row.get("question_id"), "question_id")
            topic_id = as_id(row.get("topic_id"), "topic_id")
            display_number = clean(row.get("display_number"))
            correct_answer = clean(row.get("correct_answer"))
            if question_id:
                question = db.query_one("SELECT * FROM question WHERE id = ?", (question_id,))
                if not question:
                    skipped.append({"question_id": question_id, "reason": "تست یافت نشد"})
                    continue
                display_number = display_number or question["display_number"]
                correct_answer = correct_answer or question["correct_answer"]
            elif not display_number:
                skipped.append({"row": index, "reason": "شماره یا شناسه سؤال لازم است"})
                continue
            cur.execute(
                """INSERT INTO exam_question(exam_id, question_id, display_number,
                                             correct_answer, topic_id, points, order_index,
                                             created_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                (exam_id, question_id, display_number, correct_answer, topic_id,
                 as_float(row.get("points"), "points") or 1.0,
                 order_start + index, utc_now()))
            created += 1
    return {"created": created, "skipped": skipped, "exam_id": exam_id}


def add_questions_from_topic(db: Database, exam_id: int, topic_id: int, limit: int = 20,
                             strategy: str = "untried") -> dict:
    """ساخت سریع سؤال‌های آزمون از یک مبحث (مثلاً تست‌های باقی‌مانده یا مهم)."""
    ids = subtree_ids(db, topic_id)
    marks = placeholders(ids)
    if strategy == "important":
        sql = f"""SELECT q.id FROM question q
                   JOIN question_topic qt ON qt.question_id = q.id
                   JOIN user_question_flag f ON f.question_id = q.id AND f.important = 1
                  WHERE qt.topic_id IN ({marks}) AND q.state='active' LIMIT ?"""
    elif strategy == "incorrect":
        sql = f"""SELECT q.id FROM question q
                   JOIN question_topic qt ON qt.question_id = q.id
                  WHERE qt.topic_id IN ({marks}) AND q.state='active'
                    AND (SELECT a.result FROM question_attempt a
                          WHERE a.question_id = q.id AND a.state='active'
                          ORDER BY a.attempted_at DESC, a.id DESC LIMIT 1) = 'incorrect'
                  LIMIT ?"""
    else:  # untried
        sql = f"""SELECT q.id FROM question q
                   JOIN question_topic qt ON qt.question_id = q.id
                  WHERE qt.topic_id IN ({marks}) AND q.state='active'
                    AND NOT EXISTS (SELECT 1 FROM question_attempt a
                                     WHERE a.question_id = q.id AND a.state='active')
                  LIMIT ?"""
    rows = db.query(sql, ids + [max(1, min(limit, 200))])
    if not rows:
        raise ApiError("تستی با این معیار در این مبحث یافت نشد", 404,
                       {"strategy": "معیار انتخابی نتیجه‌ای نداشت"})
    return add_questions(db, exam_id,
                         [{"question_id": r["id"], "topic_id": topic_id} for r in rows])


def remove_exam_question(db: Database, exam_question_id: int) -> dict:
    row = db.query_one("SELECT * FROM exam_question WHERE id = ?", (exam_question_id,))
    if not row:
        raise NotFound("سؤال آزمون یافت نشد")
    used = db.scalar("SELECT COUNT(*) FROM exam_answer WHERE exam_question_id = ?",
                     (exam_question_id,), 0)
    if used:
        raise Conflict("این سؤال در اجراهای ثبت‌شده آزمون استفاده شده و قابل حذف نیست")
    db.execute("DELETE FROM exam_question WHERE id = ?", (exam_question_id,))
    return {"deleted": True, "id": exam_question_id}


def update_exam_question(db: Database, exam_question_id: int, data: dict) -> dict:
    row = db.query_one("SELECT * FROM exam_question WHERE id = ?", (exam_question_id,))
    if not row:
        raise NotFound("سؤال آزمون یافت نشد")
    updates: dict[str, Any] = {}
    for field in ("display_number", "correct_answer"):
        if field in data:
            updates[field] = clean(data[field])
    if "points" in data:
        updates["points"] = as_float(data["points"], "points") or 1.0
    if "order_index" in data:
        updates["order_index"] = as_int(data["order_index"], "order_index", True) or 0
    if "topic_id" in data:
        updates["topic_id"] = as_id(data["topic_id"], "topic_id")
    if updates:
        db.update("exam_question", exam_question_id, updates)
    return db.query_one("SELECT * FROM exam_question WHERE id = ?", (exam_question_id,))


# ---------------------------------------------------------------------------
# اجرای آزمون (ExamAttempt) و پاسخ‌ها
# ---------------------------------------------------------------------------

def start_attempt(db: Database, exam_id: int, data: dict | None = None) -> dict:
    data = data or {}
    exam = get_exam(db, exam_id)
    if not exam["questions"]:
        raise Conflict("این آزمون سؤالی ندارد؛ ابتدا سؤال‌ها را اضافه کنید")
    total = len(exam["questions"])
    attempt_id = db.insert("exam_attempt", {
        "exam_id": exam_id,
        "started_at": parse_when(data.get("started_at"), required=False) or utc_now(),
        "total_questions": total,
        "state": "running",
        "notes": clean(data.get("notes")),
        "created_at": utc_now(),
    })
    return get_attempt(db, attempt_id)


def get_attempt(db: Database, attempt_id: int) -> dict:
    attempt = db.query_one(
        """SELECT ea.*, e.title AS exam_title, e.exam_type, e.subject_id
             FROM exam_attempt ea JOIN exam e ON e.id = ea.exam_id
            WHERE ea.id = ?""", (attempt_id,))
    if not attempt:
        raise NotFound("اجرای آزمون یافت نشد")
    attempt["answers"] = db.query(
        """SELECT aa.*, eq.display_number, eq.correct_answer, eq.points, eq.order_index,
                  eq.question_id, eq.topic_id, t.title AS topic_title, q.code
             FROM exam_answer aa
             JOIN exam_question eq ON eq.id = aa.exam_question_id
             LEFT JOIN topic t ON t.id = eq.topic_id
             LEFT JOIN question q ON q.id = eq.question_id
            WHERE aa.exam_attempt_id = ?
            ORDER BY eq.order_index, eq.id""", (attempt_id,))
    attempt["breakdown"] = attempt_breakdown(db, attempt_id)
    return attempt


def submit_answers(db: Database, attempt_id: int, answers: list[dict],
                   record_to_bank: bool = True, finalize: bool = True,
                   spent_seconds: int | None = None,
                   finished_at: str | None = None) -> dict:
    """ثبت پاسخ‌های یک اجرای آزمون و (اختیاری) افزودن آن‌ها به سابقه بانک تست."""
    attempt = db.query_one("SELECT * FROM exam_attempt WHERE id = ?", (attempt_id,))
    if not attempt:
        raise NotFound("اجرای آزمون یافت نشد")
    if attempt["state"] == "archived":
        raise Conflict("این اجرای آزمون آرشیو شده است")
    exam_questions = {row["id"]: row for row in db.query(
        "SELECT * FROM exam_question WHERE exam_id = ?", (attempt["exam_id"],))}
    if not answers:
        raise ApiError("پاسخی ارسال نشده است", 422, {"answers": "فهرست پاسخ خالی است"})
    written = 0
    with db.write() as cur:
        for row in answers:
            eq_id = as_id(row.get("exam_question_id") or row.get("id"), "exam_question_id")
            if not eq_id or eq_id not in exam_questions:
                raise ApiError(f"سؤال آزمون {eq_id} در این آزمون نیست", 422,
                               {"exam_question_id": "نامعتبر"})
            eq = exam_questions[eq_id]
            user_answer = clean(row.get("user_answer"))
            result = clean(row.get("result"))
            if result:
                result = as_choice(result, ["correct", "incorrect", "unanswered"],
                                   "result", allow_none=False)
            elif user_answer is None:
                result = "unanswered"
            else:
                result = compare_answer(user_answer, eq["correct_answer"])
            seconds = as_int(row.get("spent_seconds"), "spent_seconds", allow_none=True)
            cur.execute(
                """INSERT INTO exam_answer(exam_attempt_id, exam_question_id, user_answer,
                                           result, spent_seconds, answered_at)
                   VALUES (?, ?, ?, ?, ?, ?)
                   ON CONFLICT(exam_attempt_id, exam_question_id) DO UPDATE SET
                       user_answer = excluded.user_answer,
                       result = excluded.result,
                       spent_seconds = excluded.spent_seconds,
                       answered_at = excluded.answered_at""",
                (attempt_id, eq_id, user_answer, result, seconds, utc_now()))
            written += 1
            if record_to_bank and eq["question_id"] and attempt["state"] == "running":
                _mirror_to_bank(db, attempt, eq, user_answer, result, seconds)
    if finalize:
        _finalize(db, attempt_id, spent_seconds=spent_seconds, finished_at=finished_at)
    result = get_attempt(db, attempt_id)
    result["answers_written"] = written
    return result


def _mirror_to_bank(db: Database, attempt: dict, exam_question: dict,
                    user_answer: str | None, result: str, seconds: int | None) -> None:
    """هر پاسخ آزمون یک QuestionAttempt با منبع exam می‌سازد (قاعده ۷)."""
    existing = db.query_one(
        """SELECT id FROM question_attempt WHERE exam_attempt_id = ? AND question_id = ?
            AND state='active'""", (attempt["id"], exam_question["question_id"]))
    if existing:
        return
    db.insert("question_attempt", {
        "question_id": exam_question["question_id"],
        "user_answer": user_answer,
        "result": result,
        "spent_seconds": seconds,
        "attempted_at": attempt["started_at"] or utc_now(),
        "source": "exam",
        "exam_attempt_id": attempt["id"],
        "notes": f"آزمون: اجرای #{attempt['id']}",
        "created_at": utc_now(),
    })


def _finalize(db: Database, attempt_id: int, spent_seconds: int | None = None,
              finished_at: str | None = None) -> dict:
    # تاریخ پایان ممکن است شمسی وارد شود؛ همیشه پیش از ذخیره به میلادی UTC تبدیل می‌شود
    finished_at = parse_when(finished_at, required=False) if finished_at else None
    counts = db.query_one(
        """SELECT COUNT(*) AS answered,
                  SUM(CASE WHEN result='correct' THEN 1 ELSE 0 END) AS correct,
                  SUM(CASE WHEN result='incorrect' THEN 1 ELSE 0 END) AS incorrect,
                  SUM(CASE WHEN result='unanswered' THEN 1 ELSE 0 END) AS unanswered
             FROM exam_answer WHERE exam_attempt_id = ?""", (attempt_id,)) or {}
    total = db.scalar("SELECT total_questions FROM exam_attempt WHERE id = ?",
                      (attempt_id,), 0) or 0
    correct = counts.get("correct") or 0
    score = round(correct / total * 100, 2) if total else None
    summary = dumps({
        "answered": counts.get("answered") or 0,
        "total": total,
        "correct": correct,
        "incorrect": counts.get("incorrect") or 0,
        "unanswered": (counts.get("unanswered") or 0) + max(
            0, total - (counts.get("answered") or 0)),
        "score_percent": score,
        "percent": score,
    })
    with db.write() as cur:
        cur.execute(
            """UPDATE exam_attempt
                  SET correct_count = ?, incorrect_count = ?, unanswered_count = ?,
                      score_percent = ?, summary = ?, state = 'finished',
                      finished_at = COALESCE(?, finished_at, ?),
                      spent_seconds = COALESCE(?, spent_seconds)
                WHERE id = ?""",
            (correct, counts.get("incorrect") or 0,
             (counts.get("unanswered") or 0) + max(0, total - (counts.get("answered") or 0)),
             score, summary, finished_at, utc_now(), spent_seconds, attempt_id))
    db.execute("UPDATE exam SET status='held' WHERE id = "
               "(SELECT exam_id FROM exam_attempt WHERE id = ?) "
               "AND status IN ('planned','ready')", (attempt_id,))
    touched = [row["question_id"] for row in db.query(
        """SELECT eq.question_id FROM exam_answer aa
             JOIN exam_question eq ON eq.id = aa.exam_question_id
            WHERE aa.exam_attempt_id = ? AND eq.question_id IS NOT NULL""", (attempt_id,))]
    if touched:
        from .review import sync_many
        sync_many(db, touched)
    from .analytics import log_activity
    log_activity(db, "exam_attempt", "exam_attempt", attempt_id,
                 f"ثبت نتیجه اجرای آزمون با درصد {score}")
    return get_attempt(db, attempt_id)


def finish_attempt(db: Database, attempt_id: int, spent_seconds: int | None = None,
                   finished_at: str | None = None) -> dict:
    attempt = db.query_one("SELECT * FROM exam_attempt WHERE id = ?", (attempt_id,))
    if not attempt:
        raise NotFound("اجرای آزمون یافت نشد")
    answered = db.scalar("SELECT COUNT(*) FROM exam_answer WHERE exam_attempt_id = ?",
                         (attempt_id,), 0) or 0
    if answered == 0:
        raise Conflict("هیچ پاسخی برای این اجرا ثبت نشده است")
    return _finalize(db, attempt_id, spent_seconds=spent_seconds, finished_at=finished_at)


def list_attempts(db: Database, exam_id: int | None = None, *,
                  subject_id: int | None = None, page: int = 1, page_size: int = 50) -> list[dict]:
    where = []
    params: list[Any] = []
    if exam_id:
        where.append("ea.exam_id = ?")
        params.append(exam_id)
    if subject_id:
        where.append("e.subject_id = ?")
        params.append(subject_id)
    clause = " AND ".join(where) if where else "1=1"
    page = max(1, page)
    page_size = min(max(page_size, 1), 200)
    return db.query(
        f"""SELECT ea.*, e.title AS exam_title, e.exam_type, e.planned_date
              FROM exam_attempt ea JOIN exam e ON e.id = ea.exam_id
             WHERE {clause}
             ORDER BY IFNULL(ea.finished_at, ea.started_at) DESC, ea.id DESC
             LIMIT ? OFFSET ?""", params + [page_size, (page - 1) * page_size])


def archive_attempt(db: Database, attempt_id: int) -> dict:
    """اجرای آزمون حذف نمی‌شود؛ فقط آرشیو می‌شود تا سابقه بماند."""
    attempt = db.query_one("SELECT * FROM exam_attempt WHERE id = ?", (attempt_id,))
    if not attempt:
        raise NotFound("اجرای آزمون یافت نشد")
    db.update("exam_attempt", attempt_id, {"state": "archived"})
    return {"archived": True, "id": attempt_id}


def attempt_breakdown(db: Database, attempt_id: int) -> dict:
    """تحلیل اجرای آزمون بر پایه مبحث و درس."""
    by_topic = db.query(
        """SELECT IFNULL(t.title, 'بدون مبحث') AS topic_title, eq.topic_id,
                  COUNT(*) AS total,
                  SUM(CASE WHEN aa.result='correct' THEN 1 ELSE 0 END) AS correct,
                  SUM(CASE WHEN aa.result='incorrect' THEN 1 ELSE 0 END) AS incorrect,
                  SUM(CASE WHEN aa.result='unanswered' THEN 1 ELSE 0 END) AS unanswered,
                  ROUND(100.0 * SUM(CASE WHEN aa.result='correct' THEN 1 ELSE 0 END)
                        / COUNT(*), 1) AS percent
             FROM exam_answer aa
             JOIN exam_question eq ON eq.id = aa.exam_question_id
             LEFT JOIN topic t ON t.id = eq.topic_id
            WHERE aa.exam_attempt_id = ?
            GROUP BY eq.topic_id ORDER BY percent""", (attempt_id,))
    overall = db.query_one(
        """SELECT COUNT(*) AS answered, SUM(eq.points) AS points
             FROM exam_answer aa JOIN exam_question eq ON eq.id = aa.exam_question_id
            WHERE aa.exam_attempt_id = ?""", (attempt_id,)) or {}
    weakest = by_topic[0] if by_topic else None
    return {"by_topic": by_topic, "weakest_topic": weakest,
            "answered": overall.get("answered") or 0,
            "points_total": overall.get("points") or 0}


def exam_summary(db: Database, exam_id: int) -> dict:
    attempts = db.query(
        """SELECT id, score_percent, correct_count, incorrect_count, unanswered_count,
                  COALESCE(finished_at, started_at) AS at, state
             FROM exam_attempt WHERE exam_id = ? ORDER BY at""", (exam_id,))
    scores = [row["score_percent"] for row in attempts if row["score_percent"] is not None]
    trend = "flat"
    if len(scores) >= 2:
        if scores[-1] > scores[0]:
            trend = "up"
        elif scores[-1] < scores[0]:
            trend = "down"
    return {
        "attempt_count": len(attempts),
        "best_score": max(scores) if scores else None,
        "last_score": scores[-1] if scores else None,
        "average_score": round(sum(scores) / len(scores), 2) if scores else None,
        "trend": trend,
        "scores": scores,
        "attempts": attempts,
    }


# ---------------------------------------------------------------------------
# فایل سؤال (PDF/تصویر)
# ---------------------------------------------------------------------------

def add_asset(db: Database, exam_id: int, file_path: str, file_type: str,
              original_name: str | None = None, byte_size: int | None = None,
              metadata: dict | None = None, exam_question_id: int | None = None) -> dict:
    _exam_row(db, exam_id)
    asset_id = db.insert("exam_asset", {
        "exam_id": exam_id,
        "exam_question_id": exam_question_id,
        "file_type": file_type,
        "file_path": file_path,
        "original_name": clean(original_name),
        "byte_size": byte_size,
        "metadata": dumps(metadata or {}),
        "created_at": utc_now(),
    })
    return db.query_one("SELECT * FROM exam_asset WHERE id = ?", (asset_id,))


def list_assets(db: Database, exam_id: int) -> list[dict]:
    rows = db.query("SELECT * FROM exam_asset WHERE exam_id = ? ORDER BY id", (exam_id,))
    for row in rows:
        row["metadata_parsed"] = loads(row.get("metadata"), {})
    return rows


def delete_asset(db: Database, asset_id: int) -> dict:
    row = db.query_one("SELECT * FROM exam_asset WHERE id = ?", (asset_id,))
    if not row:
        raise NotFound("فایل پیوست یافت نشد")
    db.execute("DELETE FROM exam_asset WHERE id = ?", (asset_id,))
    return {"deleted": True, "id": asset_id, "file_path": row["file_path"]}


def grade_attempt_manual(db: Database, attempt_id: int, results: list[dict]) -> dict:
    """اصلاح دستی نتیجه چند سؤال پس از ثبت (برای سؤال‌های بی‌کلید)."""
    attempt = db.query_one("SELECT * FROM exam_attempt WHERE id = ?", (attempt_id,))
    if not attempt:
        raise NotFound("اجرای آزمون یافت نشد")
    updated = 0
    with db.write() as cur:
        for row in results:
            eq_id = as_id(row.get("exam_question_id"), "exam_question_id")
            result = as_choice(row.get("result"), ["correct", "incorrect", "unanswered"],
                               "result", allow_none=False)
            cur.execute(
                """UPDATE exam_answer SET result = ?
                    WHERE exam_attempt_id = ? AND exam_question_id = ?""",
                (result, attempt_id, eq_id))
            updated += cur.rowcount
    _finalize(db, attempt_id)
    return {"updated": updated, "attempt": get_attempt(db, attempt_id)}
