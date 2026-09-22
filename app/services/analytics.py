"""ماژول ۱۰ و ۱۱ — تحلیل، آمار و داشبورد.

قاعده ۱۰: هیچ عددی ذخیره و جایگزین سابقه نمی‌شود؛ همه شاخص‌ها هر بار از
داده‌های خام (question_attempt، previous_question_entry، exam_answer و ...)
محاسبه می‌شوند. آمار فقط تلاش‌های «فعال» را می‌شمارد (رکوردهای باطل‌شده کنار
گذاشته می‌شوند ولی حذف نمی‌شوند).
"""
from __future__ import annotations

from datetime import date, timedelta
from typing import Any

from ..config import ANALYTICS_LEVELS
from ..core import ApiError, as_id, human_when
from ..db import Database, dumps, loads, placeholders, today_iso, utc_now
from .topics import topic_path

METRIC_SQL = """
    COUNT(*) AS attempts,
    COUNT(DISTINCT a.question_id) AS questions,
    SUM(CASE WHEN a.result='correct' THEN 1 ELSE 0 END) AS correct,
    SUM(CASE WHEN a.result='incorrect' THEN 1 ELSE 0 END) AS incorrect,
    SUM(CASE WHEN a.result='unanswered' THEN 1 ELSE 0 END) AS unanswered,
    SUM(CASE WHEN a.result='correct' AND a.spent_seconds IS NOT NULL THEN 1 ELSE 0 END)
        AS timed_correct,
    SUM(a.spent_seconds) AS total_seconds,
    SUM(CASE WHEN a.spent_seconds IS NOT NULL THEN 1 ELSE 0 END) AS timed_attempts,
    MIN(a.attempted_at) AS first_attempt_at,
    MAX(a.attempted_at) AS last_attempt_at
"""


def _finalize_metrics(row: dict) -> dict:
    attempts = row.get("attempts") or 0
    correct = row.get("correct") or 0
    incorrect = row.get("incorrect") or 0
    answered = correct + incorrect
    row["attempts"] = attempts
    row["questions"] = row.get("questions") or 0
    row["correct"] = correct
    row["incorrect"] = incorrect
    row["unanswered"] = row.get("unanswered") or 0
    row["accuracy"] = round(correct / answered * 100, 1) if answered else None
    row["correct_rate"] = round(correct / attempts * 100, 1) if attempts else None
    row["wrong_rate"] = round((incorrect + (row.get("unanswered") or 0)) / attempts * 100, 1) \
        if attempts else None
    timed = row.get("timed_attempts") or 0
    row["average_seconds"] = round((row.get("total_seconds") or 0) / timed, 1) if timed else None
    row["last_attempt_at"] = row.get("last_attempt_at")
    row["last_attempt_label"] = human_when(row.get("last_attempt_at"))
    return row


# ---------------------------------------------------------------------------
# گزارش رویدادها
# ---------------------------------------------------------------------------

def log_activity(db: Database, kind: str, entity: str | None = None,
                 entity_id: int | None = None, message: str = "",
                 payload: dict | None = None) -> None:
    db.insert("activity_log", {
        "at": utc_now(), "kind": kind, "entity": entity,
        "entity_id": entity_id, "message": message,
        "payload": dumps(payload or {}),
    })


def activity_feed(db: Database, limit: int = 30) -> list[dict]:
    rows = db.query("SELECT * FROM activity_log ORDER BY id DESC LIMIT ?",
                    (min(max(limit, 1), 200),))
    for row in rows:
        row["time_label"] = human_when(row["at"])
        row["payload_parsed"] = loads(row.get("payload"), {})
    return rows


# ---------------------------------------------------------------------------
# شاخص‌های کلی
# ---------------------------------------------------------------------------

def headline(db: Database) -> dict:
    questions = db.query_one(
        """SELECT COUNT(*) AS total,
                  SUM(CASE WHEN state='archived' THEN 1 ELSE 0 END) AS archived,
                  SUM(CASE WHEN correct_answer IS NULL OR correct_answer='' THEN 1 ELSE 0 END)
                      AS without_key
             FROM question""") or {}
    attempts = db.query_one(
        """SELECT COUNT(*) AS total,
                  SUM(CASE WHEN state='voided' THEN 1 ELSE 0 END) AS voided
             FROM question_attempt""") or {}
    previous = db.query_one(
        """SELECT COUNT(*) AS total,
                  SUM(CASE WHEN state='voided' THEN 1 ELSE 0 END) AS voided
             FROM previous_question_entry""") or {}
    solved = db.scalar(
        """SELECT COUNT(DISTINCT question_id) FROM question_attempt WHERE state='active'""",
        (), 0) or 0
    review_open = db.scalar(
        """SELECT COUNT(*) FROM review_item WHERE state IN ('open','in_progress')""",
        (), 0) or 0
    flags = db.query_one(
        """SELECT SUM(CASE WHEN important=1 THEN 1 ELSE 0 END) AS important,
                  SUM(CASE WHEN hard=1 THEN 1 ELSE 0 END) AS hard
             FROM user_question_flag""") or {}
    return {
        "questions": questions.get("total") or 0,
        "archived_questions": questions.get("archived") or 0,
        "questions_without_key": questions.get("without_key") or 0,
        "attempts": attempts.get("total") or 0,
        "voided_attempts": attempts.get("voided") or 0,
        "previous_entries": previous.get("total") or 0,
        "solved_questions": solved,
        "unsolved_questions": max(0, (questions.get("total") or 0), 0) - solved,
        "open_reviews": review_open,
        "important": flags.get("important") or 0,
        "hard": flags.get("hard") or 0,
        "subjects": db.scalar("SELECT COUNT(*) FROM subject WHERE state='active'", (), 0) or 0,
        "books": db.scalar("SELECT COUNT(*) FROM book WHERE state='active'", (), 0) or 0,
        "topics": db.scalar("SELECT COUNT(*) FROM topic WHERE status <> 'archived'", (), 0) or 0,
        "exams": db.scalar("SELECT COUNT(*) FROM exam WHERE status <> 'archived'", (), 0) or 0,
    }


def window_metrics(db: Database, days: int, subject_id: int | None = None) -> dict:
    start = (date.fromisoformat(today_iso()) - timedelta(days=days - 1)).isoformat()
    where = ["a.state='active'", "a.attempted_at >= ?"]
    params: list[Any] = [start]
    if subject_id:
        where.append("b.subject_id = ?")
        params.append(subject_id)
    row = db.query_one(
        f"""SELECT COUNT(*) AS attempts,
                   COUNT(DISTINCT a.question_id) AS questions,
                   SUM(CASE WHEN a.result='correct' THEN 1 ELSE 0 END) AS correct,
                   SUM(CASE WHEN a.result='incorrect' THEN 1 ELSE 0 END) AS incorrect,
                   SUM(CASE WHEN a.result='unanswered' THEN 1 ELSE 0 END) AS unanswered,
                   SUM(a.spent_seconds) AS total_seconds,
                   COUNT(DISTINCT date(a.attempted_at)) AS active_days
              FROM question_attempt a
              JOIN question q ON q.id = a.question_id
              LEFT JOIN book b ON b.id = q.book_id
             WHERE {' AND '.join(where)}""", params) or {}
    row = _finalize_metrics(row)
    row["window_days"] = days
    return row


def compare_windows(db: Database, days: int = 7) -> dict:
    """مقایسه بازه جاری با بازه قبلی هم‌اندازه (برای نمودار روند)."""
    current = window_metrics(db, days)
    end = date.fromisoformat(today_iso()) - timedelta(days=days)
    start = end - timedelta(days=days - 1)
    row = db.query_one(
        """SELECT COUNT(*) AS attempts,
                  SUM(CASE WHEN a.result='correct' THEN 1 ELSE 0 END) AS correct,
                  SUM(CASE WHEN a.result='incorrect' THEN 1 ELSE 0 END) AS incorrect,
                  SUM(CASE WHEN a.result='unanswered' THEN 1 ELSE 0 END) AS unanswered
             FROM question_attempt a
            WHERE a.state='active' AND a.attempted_at >= ? AND a.attempted_at < ?""",
        (start.isoformat(), (end + timedelta(days=1)).isoformat())) or {}
    previous = _finalize_metrics(row)
    delta_attempts = (current["attempts"] or 0) - (previous["attempts"] or 0)
    delta_accuracy = None
    if current["accuracy"] is not None and previous["accuracy"] is not None:
        delta_accuracy = round(current["accuracy"] - previous["accuracy"], 1)
    return {"current": current, "previous": previous,
            "delta_attempts": delta_attempts, "delta_accuracy": delta_accuracy}


# ---------------------------------------------------------------------------
# تحلیل چندسطحی
# ---------------------------------------------------------------------------

def timeseries(db: Database, unit: str = "day", window: int = 30,
               subject_id: int | None = None, topic_id: int | None = None,
               book_id: int | None = None) -> dict:
    if unit not in ("day", "week", "month"):
        raise ApiError("واحد زمانی نامعتبر است", 422,
                       {"unit": "یکی از day/week/month"})
    fmt = {"day": "%Y-%m-%d", "week": "%Y-W%W", "month": "%Y-%m"}[unit]
    days = {"day": window, "week": window * 7, "month": window * 30}[unit]
    start = (date.fromisoformat(today_iso()) - timedelta(days=max(days, 1) - 1)).isoformat()
    where = ["a.state='active'", "a.attempted_at >= ?"]
    params: list[Any] = [start]
    if subject_id:
        where.append("b.subject_id = ?")
        params.append(subject_id)
    if book_id:
        where.append("q.book_id = ?")
        params.append(book_id)
    if topic_id:
        from .topics import subtree_ids
        ids = subtree_ids(db, topic_id)
        where.append(f"""q.id IN (SELECT question_id FROM question_topic
                                   WHERE topic_id IN ({placeholders(ids)}))""")
        params.extend(ids)
    rows = db.query(
        f"""SELECT strftime('{fmt}', a.attempted_at) AS bucket,
                   COUNT(*) AS attempts,
                   COUNT(DISTINCT a.question_id) AS questions,
                   SUM(CASE WHEN a.result='correct' THEN 1 ELSE 0 END) AS correct,
                   SUM(CASE WHEN a.result='incorrect' THEN 1 ELSE 0 END) AS incorrect,
                   SUM(CASE WHEN a.result='unanswered' THEN 1 ELSE 0 END) AS unanswered
              FROM question_attempt a
              JOIN question q ON q.id = a.question_id
              LEFT JOIN book b ON b.id = q.book_id
             WHERE {' AND '.join(where)}
             GROUP BY bucket ORDER BY bucket""", params)
    series = [_finalize_metrics(row) for row in rows]
    return {"unit": unit, "series": series,
            "total_attempts": sum(row["attempts"] for row in series),
            "total_correct": sum(row["correct"] for row in series)}


def performance(db: Database, level: str = "overall", *, subject_id: int | None = None,
                book_id: int | None = None, book_node_id: int | None = None,
                topic_id: int | None = None, days: int | None = None,
                limit: int = 200) -> dict:
    if level not in ANALYTICS_LEVELS:
        raise ApiError("سطح تحلیل نامعتبر است", 422,
                       {"level": f"مقادیر مجاز: {', '.join(ANALYTICS_LEVELS)}"})
    if level in ("exam",):
        return {"level": level, "rows": exam_performance(db, subject_id=subject_id,
                                                         limit=limit)}
    joins = ["JOIN question q ON q.id = a.question_id"]
    group = None
    labels = None
    where = ["a.state='active'"]
    params: list[Any] = []

    if level in ("subject", "book", "book_node", "question"):
        joins.append("LEFT JOIN book b ON b.id = q.book_id")
        joins.append("LEFT JOIN subject s ON s.id = b.subject_id")
    if level in ("book_node", "question"):
        joins.append("LEFT JOIN book_node bn ON bn.id = q.book_node_id")
    if level == "subject":
        group, labels = "s.id, s.name", "نام درس"
    elif level == "book":
        group, labels = "b.id, b.title, b.publisher", "کتاب"
    elif level == "book_node":
        group, labels = "bn.id, bn.title, bn.node_type", "محل در کتاب"
    elif level == "topic":
        joins.append("JOIN question_topic qt ON qt.question_id = q.id")
        joins.append("JOIN topic t ON t.id = qt.topic_id")
        group, labels = "t.id, t.title", "مبحث"
    elif level == "question":
        group, labels = "q.id, q.code, q.display_number", "تست"
    elif level in ("day", "week", "month"):
        fmt = {"day": "%Y-%m-%d", "week": "%Y-W%W", "month": "%Y-%m"}[level]
        group, labels = f"strftime('{fmt}', a.attempted_at)", "بازه زمانی"
    if subject_id:
        where.append("b.subject_id = ?")
        params.append(subject_id)
    if book_id:
        where.append("q.book_id = ?")
        params.append(book_id)
    if book_node_id:
        from .resources import descendants
        node_ids = [book_node_id] + [n["id"] for n in descendants(db, book_node_id)]
        where.append(f"q.book_node_id IN ({placeholders(node_ids)})")
        params.extend(node_ids)
    if topic_id:
        from .topics import subtree_ids
        ids = subtree_ids(db, topic_id)
        where.append(f"""q.id IN (SELECT question_id FROM question_topic
                                   WHERE topic_id IN ({placeholders(ids)}))""")
        params.extend(ids)
    if days:
        start = (date.fromisoformat(today_iso()) - timedelta(days=days - 1)).isoformat()
        where.append("a.attempted_at >= ?")
        params.append(start)
    where_sql = " AND ".join(where)
    if group is None:
        row = db.query_one(
            f"""SELECT {METRIC_SQL} FROM question_attempt a {' '.join(joins)}
                 WHERE {where_sql}""", params) or {}
        extra = question_bank_counts(db, subject_id=subject_id, book_id=book_id,
                                     topic_id=topic_id, book_node_id=book_node_id)
        row.update(extra)
        return {"level": level, "totals": _finalize_metrics(row), "rows": []}
    rows = db.query(
        f"""SELECT {group} AS group_key, {METRIC_SQL}
              FROM question_attempt a {' '.join(joins)}
             WHERE {where_sql}
             GROUP BY group_key
             ORDER BY attempts DESC LIMIT ?""", params + [limit])
    for row in rows:
        _finalize_metrics(row)
        if level == "subject":
            row["title"] = row.pop("name", None) or "بدون درس"
        elif level == "book":
            row["title"] = row.pop("title", None) or "بدون کتاب"
        elif level == "book_node":
            row["title"] = row.pop("title", None) or "بدون محل"
            row["node_type"] = row.pop("node_type", None)
        elif level == "topic":
            row["topic_id"] = row.pop("id", None)
            row["title"] = row.pop("title", None)
            row["path"] = topic_path(db, row["topic_id"]) if row.get("topic_id") else None
        elif level == "question":
            row["question_id"] = row.pop("id", None)
            row["code"] = row.pop("code", None)
            row["display_number"] = row.pop("display_number", None)
            row["title"] = f"{row['code']}"
    return {"level": level, "rows": rows, "labels": labels,
            "totals": _finalize_metrics(db.query_one(
                f"""SELECT {METRIC_SQL} FROM question_attempt a {' '.join(joins)}
                     WHERE {where_sql}""", params) or {})}


def question_bank_counts(db: Database, *, subject_id: int | None = None,
                         book_id: int | None = None, topic_id: int | None = None,
                         book_node_id: int | None = None) -> dict:
    where = ["q.state='active'"]
    params: list[Any] = []
    if subject_id:
        where.append("b.subject_id = ?")
        params.append(subject_id)
    if book_id:
        where.append("q.book_id = ?")
        params.append(book_id)
    if book_node_id:
        from .resources import descendants
        node_ids = [book_node_id] + [n["id"] for n in descendants(db, book_node_id)]
        where.append(f"q.book_node_id IN ({placeholders(node_ids)})")
        params.extend(node_ids)
    if topic_id:
        from .topics import subtree_ids
        ids = subtree_ids(db, topic_id)
        where.append(f"""q.id IN (SELECT question_id FROM question_topic
                                   WHERE topic_id IN ({placeholders(ids)}))""")
        params.extend(ids)
    row = db.query_one(
        f"""SELECT COUNT(*) AS bank_questions,
                   SUM(CASE WHEN EXISTS (SELECT 1 FROM question_attempt a
                                          WHERE a.question_id=q.id AND a.state='active')
                            THEN 1 ELSE 0 END) AS bank_attempted,
                   SUM(CASE WHEN f.important=1 THEN 1 ELSE 0 END) AS bank_important,
                   SUM(CASE WHEN f.hard=1 THEN 1 ELSE 0 END) AS bank_hard
              FROM question q
              LEFT JOIN book b ON b.id = q.book_id
              LEFT JOIN user_question_flag f ON f.question_id = q.id
             WHERE {' AND '.join(where)}""", params) or {}
    return {
        "bank_questions": row.get("bank_questions") or 0,
        "bank_attempted": row.get("bank_attempted") or 0,
        "bank_untouched": max(0, (row.get("bank_questions") or 0)
                              - (row.get("bank_attempted") or 0)),
        "bank_important": row.get("bank_important") or 0,
        "bank_hard": row.get("bank_hard") or 0,
    }


def exam_performance(db: Database, *, subject_id: int | None = None,
                     limit: int = 100) -> list[dict]:
    where = ["ea.state='finished'"]
    params: list[Any] = []
    if subject_id:
        where.append("e.subject_id = ?")
        params.append(subject_id)
    rows = db.query(
        f"""SELECT ea.id AS attempt_id, ea.exam_id, e.title, e.exam_type,
                   ea.score_percent, ea.correct_count, ea.incorrect_count,
                   ea.unanswered_count, ea.total_questions,
                   COALESCE(ea.finished_at, ea.started_at) AS at
              FROM exam_attempt ea JOIN exam e ON e.id = ea.exam_id
             WHERE {' AND '.join(where)}
             ORDER BY at DESC LIMIT ?""", params + [limit])
    for row in rows:
        row["at_label"] = human_when(row["at"])
    return rows


def exam_metrics(db: Database, subject_id: int | None = None) -> dict:
    where = ["state='finished'"]
    params: list[Any] = []
    clause = " AND ".join(where)
    row = db.query_one(
        f"""SELECT COUNT(*) AS attempts, AVG(score_percent) AS average_score,
                   MAX(score_percent) AS best_score,
                   SUM(total_questions) AS questions,
                   SUM(correct_count) AS correct,
                   SUM(incorrect_count) AS incorrect,
                   SUM(unanswered_count) AS unanswered
              FROM exam_attempt WHERE {clause}""", params) or {}
    attempts = db.scalar("SELECT COUNT(*) FROM exam_attempt WHERE state='running'", (), 0) or 0
    row["running_attempts"] = attempts
    row["average_score"] = round(row["average_score"], 1) if row.get("average_score") else None
    return row


def topic_leaderboard(db: Database, subject_id: int | None = None, limit: int = 10,
                      min_attempts: int = 5) -> dict:
    where = ["t.status <> 'archived'", "a.state='active'"]
    params: list[Any] = []
    if subject_id:
        where.append("t.subject_id = ?")
        params.append(subject_id)
    rows = db.query(
        f"""SELECT t.id AS topic_id, t.title,
                   COUNT(a.id) AS attempts,
                   SUM(CASE WHEN a.result='correct' THEN 1 ELSE 0 END) AS correct,
                   SUM(CASE WHEN a.result='incorrect' THEN 1 ELSE 0 END) AS incorrect,
                   SUM(CASE WHEN a.result='unanswered' THEN 1 ELSE 0 END) AS unanswered,
                   ROUND(100.0 * SUM(CASE WHEN a.result='correct' THEN 1 ELSE 0 END)
                         / MAX(COUNT(a.id), 1), 1) AS correct_rate
              FROM topic t
              JOIN question_topic qt ON qt.topic_id = t.id
              JOIN question q ON q.id = qt.question_id AND q.state='active'
              JOIN question_attempt a ON a.question_id = q.id
             WHERE {' AND '.join(where)}
             GROUP BY t.id HAVING COUNT(a.id) >= ?
             ORDER BY correct_rate DESC""", params + [min_attempts])
    for row in rows:
        row["path"] = topic_path(db, row["topic_id"])
    strongest = rows[:limit]
    weakest = list(reversed(rows))[:limit]
    return {"strongest": strongest, "weakest": weakest, "sample": len(rows)}


def streak(db: Database) -> dict:
    """زنجیره روزهای متوالی فعالیت و زنجیره پاسخ‌های درست متوالی."""
    days = [row["d"] for row in db.query(
        """SELECT DISTINCT date(attempted_at) AS d FROM question_attempt
            WHERE state='active' ORDER BY d DESC LIMIT 400""")]
    active_streak = 0
    if days:
        cursor = date.fromisoformat(today_iso())
        if days[0] != cursor.isoformat():
            cursor = date.fromisoformat(days[0])
        for day in days:
            if day == cursor.isoformat():
                active_streak += 1
                cursor -= timedelta(days=1)
            else:
                break
    last_results = [row["result"] for row in db.query(
        """SELECT result FROM question_attempt WHERE state='active'
            ORDER BY attempted_at DESC, id DESC LIMIT 200""")]
    correct_streak = 0
    for result in last_results:
        if result == "correct":
            correct_streak += 1
        else:
            break
    return {"active_days_streak": active_streak,
            "correct_answer_streak": correct_streak,
            "total_active_days": len(days)}


# ---------------------------------------------------------------------------
# داشبورد
# ---------------------------------------------------------------------------

def dashboard(db: Database, subject_id: int | None = None) -> dict:
    from .readiness import upcoming_exams
    from .review import review_summary
    from .teaching import overview as teaching_overview

    head = headline(db)
    return {
        "headline": head,
        "today": window_metrics(db, 1, subject_id),
        "week": window_metrics(db, 7, subject_id),
        "month": window_metrics(db, 30, subject_id),
        "trend": compare_windows(db, 7),
        "streak": streak(db),
        "subjects": performance(db, "subject", subject_id=subject_id, limit=20)["rows"],
        "weakest_topics": topic_leaderboard(db, subject_id, limit=5)["weakest"],
        "strongest_topics": topic_leaderboard(db, subject_id, limit=5)["strongest"],
        "series": timeseries(db, "day", window=14, subject_id=subject_id)["series"],
        "review": review_summary(db, sync=False),
        "teaching": teaching_overview(db, subject_id)["totals"],
        "behind_topics": teaching_overview(db, subject_id)["behind"][:8],
        "upcoming_exams": upcoming_exams(db, days=90),
        "exams": exam_metrics(db, subject_id),
        "activity": activity_feed(db, limit=12),
        "generated_at": utc_now(),
    }
