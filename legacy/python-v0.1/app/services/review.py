"""ماژول ۵ — مرور هوشمند.

فهرست‌های مرور بر پایه ترکیب این دلایل ساخته می‌شود (بند ۸ سند ۰۱):
  غلط، بی‌پاسخ، غلطِ سابقه قبلی، بی‌پاسخِ سابقه قبلی، مهم، سخت،
  باقی‌مانده از هدف، مرتبط با آزمون آینده و افزودن دستی.

دو سطح مورد مرور وجود دارد:
  • سطح تست   : دلیل‌ها از خود تست می‌آید (آخرین تلاش، سابقه قبلی، علامت‌ها).
  • سطح مبحث : «باقی‌مانده از هدف» و «آزمون آینده» به‌صورت یک کار مبحثی ثبت می‌شود
               تا برای هر تست یک ردیف اضافه ایجاد نشود.

هر مورد مرور، دلیل/دلایل خود را در ستون reasons نگه می‌دارد و وضعیت
(open / in_progress / resolved / archived) آن قابل تغییر است.
"""
from __future__ import annotations

from typing import Any, Iterable

from ..config import REVIEW_REASONS, REVIEW_STATES
from ..core import ApiError, NotFound, as_choice, as_id, as_int, clean, like_pattern, paginate
from ..db import Database, dumps, loads, placeholders, today_iso, utc_now
from .topics import subtree_ids, topic_path

QUESTION_REASONS = ["incorrect", "unanswered", "incorrect_previous",
                    "unanswered_previous", "important", "hard", "manual"]
TOPIC_REASONS = ["goal_remaining", "upcoming_exam", "manual"]

REASON_WEIGHTS = {
    "incorrect": 50,
    "unanswered": 45,
    "incorrect_previous": 30,
    "unanswered_previous": 25,
    "important": 20,
    "upcoming_exam": 20,
    "hard": 15,
    "goal_remaining": 10,
    "manual": 5,
}


def compute_priority(reasons: Iterable[str]) -> int:
    return min(100, sum(REASON_WEIGHTS.get(reason, 5) for reason in reasons))


# ---------------------------------------------------------------------------
# همگام‌سازی خودکار موارد مرور
# ---------------------------------------------------------------------------

def question_facts(db: Database, question_id: int) -> dict:
    last_attempt = db.query_one(
        """SELECT result, attempted_at, user_answer FROM question_attempt
            WHERE question_id = ? AND state='active'
            ORDER BY attempted_at DESC, id DESC LIMIT 1""", (question_id,))
    last_previous = db.query_one(
        """SELECT result, imported_at FROM previous_question_entry
            WHERE question_id = ? AND state='active'
            ORDER BY imported_at DESC, id DESC LIMIT 1""", (question_id,))
    flags = db.query_one("SELECT important, hard FROM user_question_flag WHERE question_id = ?",
                         (question_id,)) or {}
    return {
        "last_attempt_result": last_attempt["result"] if last_attempt else None,
        "last_attempt_at": last_attempt["attempted_at"] if last_attempt else None,
        "has_attempt": bool(last_attempt),
        "last_previous_result": last_previous["result"] if last_previous else None,
        "has_previous": bool(last_previous),
        "important": bool(flags.get("important")),
        "hard": bool(flags.get("hard")),
    }


def desired_reasons(facts: dict, existing_reasons: list[str]) -> list[str]:
    reasons: list[str] = []
    if facts["last_attempt_result"] == "incorrect":
        reasons.append("incorrect")
    elif facts["last_attempt_result"] == "unanswered":
        reasons.append("unanswered")
    # اگر تست فقط سابقه قبلی دارد و آن هم غلط بوده
    if not facts["has_attempt"] and facts["last_previous_result"] == "incorrect":
        reasons.append("incorrect_previous")
    elif facts["last_previous_result"] == "incorrect":
        reasons.append("incorrect_previous")
    if facts["last_previous_result"] == "unanswered":
        reasons.append("unanswered_previous")
    if facts["important"]:
        reasons.append("important")
    if facts["hard"]:
        reasons.append("hard")
    if "manual" in (existing_reasons or []):
        reasons.append("manual")
    return [r for r in reasons if r in QUESTION_REASONS]


def sync_question_review(db: Database, question_id: int) -> dict | None:
    """همگام‌سازی مورد مرور یک تست با واقعیت داده‌های خام."""
    existing = db.query_one(
        """SELECT * FROM review_item WHERE question_id = ?
            AND state IN ('open','in_progress') LIMIT 1""", (question_id,))
    existing_reasons = loads(existing["reasons"], []) if existing else []
    facts = question_facts(db, question_id)
    reasons = desired_reasons(facts, existing_reasons)
    if not reasons:
        if existing:
            db.update("review_item", existing["id"], {
                "state": "resolved", "reasons": dumps([]),
                "resolved_at": utc_now(), "updated_at": utc_now(),
            })
        return None
    priority = compute_priority(reasons)
    if existing:
        if loads(existing["reasons"], []) == reasons and existing["priority"] == priority:
            return existing
        db.update("review_item", existing["id"], {
            "reasons": dumps(reasons), "priority": priority, "updated_at": utc_now(),
        })
        return db.query_one("SELECT * FROM review_item WHERE id = ?", (existing["id"],))
    item_id = db.insert("review_item", {
        "question_id": question_id,
        "reasons": dumps(reasons),
        "priority": priority,
        "state": "open",
        "origin": "manual" if reasons == ["manual"] else "auto",
        "created_at": utc_now(),
        "updated_at": utc_now(),
    })
    return db.query_one("SELECT * FROM review_item WHERE id = ?", (item_id,))


def sync_many(db: Database, question_ids: Iterable[int]) -> int:
    count = 0
    for question_id in set(question_ids):
        sync_question_review(db, question_id)
        count += 1
    return count


def topic_facts(db: Database, topic_id: int) -> dict:
    ids = subtree_ids(db, topic_id)
    marks = placeholders(ids)
    goal = db.scalar(
        f"""SELECT SUM(target_count) FROM teaching_test_goal
             WHERE topic_id IN ({marks}) AND status='active'""", ids, 0) or 0
    attempted = db.scalar(
        f"""SELECT COUNT(DISTINCT a.question_id) FROM question_attempt a
             JOIN question_topic qt ON qt.question_id = a.question_id
            WHERE qt.topic_id IN ({marks}) AND a.state='active'""", ids, 0) or 0
    upcoming = db.query_one(
        f"""SELECT p.id, p.title, p.exam_date FROM future_exam_plan p
             JOIN future_exam_plan_topic pt ON pt.plan_id = p.id
            WHERE pt.topic_id IN ({marks})
              AND p.preparation_status NOT IN ('done')
              AND (p.exam_date IS NULL OR p.exam_date >= ?)
            ORDER BY p.exam_date LIMIT 1""", ids + [today_iso()])
    return {
        "target_count": goal,
        "attempted_count": attempted,
        "remaining": max(0, goal - attempted),
        "upcoming_plan": upcoming,
    }


def sync_topic_review(db: Database, topic_id: int) -> dict | None:
    existing = db.query_one(
        """SELECT * FROM review_item WHERE topic_id = ? AND question_id IS NULL
            AND state IN ('open','in_progress') LIMIT 1""", (topic_id,))
    existing_reasons = loads(existing["reasons"], []) if existing else []
    facts = topic_facts(db, topic_id)
    reasons: list[str] = []
    if facts["remaining"] > 0:
        reasons.append("goal_remaining")
    if facts["upcoming_plan"]:
        reasons.append("upcoming_exam")
    if "manual" in existing_reasons:
        reasons.append("manual")
    if not reasons:
        if existing:
            db.update("review_item", existing["id"], {
                "state": "resolved", "reasons": dumps([]),
                "resolved_at": utc_now(), "updated_at": utc_now(),
            })
        return None
    note = None
    if facts["upcoming_plan"]:
        note = f"آزمون آینده: {facts['upcoming_plan']['title']}"
    if facts["remaining"] > 0:
        note = (note + " | " if note else "") + f"باقی‌مانده از هدف: {facts['remaining']} تست"
    priority = compute_priority(reasons)
    if existing:
        db.update("review_item", existing["id"], {
            "reasons": dumps(reasons), "priority": priority,
            "note": note, "updated_at": utc_now(),
        })
        return db.query_one("SELECT * FROM review_item WHERE id = ?", (existing["id"],))
    item_id = db.insert("review_item", {
        "topic_id": topic_id,
        "reasons": dumps(reasons),
        "priority": priority,
        "state": "open",
        "origin": "goal" if "goal_remaining" in reasons else "plan",
        "note": note,
        "created_at": utc_now(),
        "updated_at": utc_now(),
    })
    return db.query_one("SELECT * FROM review_item WHERE id = ?", (item_id,))


def sync_all(db: Database, sync_topics: bool = True) -> dict:
    """بازسازی کامل فهرست مرور از روی داده خام (قابل اجرا در هر زمان)."""
    question_rows = db.query("SELECT id FROM question WHERE state='active'")
    for row in question_rows:
        sync_question_review(db, row["id"])
    topic_count = 0
    if sync_topics:
        topics = db.query("SELECT id FROM topic WHERE status <> 'archived'")
        for row in topics:
            sync_topic_review(db, row["id"])
            topic_count += 1
    return {"questions_synced": len(question_rows), "topics_synced": topic_count,
            "open_items": db.scalar(
                "SELECT COUNT(*) FROM review_item WHERE state IN ('open','in_progress')", (), 0)}


# ---------------------------------------------------------------------------
# فهرست مرور
# ---------------------------------------------------------------------------

def _decode_item(row: dict) -> dict:
    row["reasons"] = loads(row["reasons"], []) or []
    row["reason_labels"] = row["reasons"]
    return row


def list_items(db: Database, *, reasons: list[str] | None = None,
               state: str = "open", level: str | None = None,
               subject_id: int | None = None, book_id: int | None = None,
               topic_id: int | None = None, book_node_id: int | None = None,
               min_priority: int | None = None, search: str | None = None,
               page: int = 1, page_size: int = 50, sync: bool = True) -> dict:
    if sync:
        sync_all(db)
    where = []
    params: list[Any] = []
    if state == "open":
        where.append("r.state IN ('open','in_progress')")
    elif state and state != "all":
        where.append("r.state = ?")
        params.append(state)
    if level == "question":
        where.append("r.question_id IS NOT NULL")
    elif level == "topic":
        where.append("r.question_id IS NULL AND r.topic_id IS NOT NULL")
    if min_priority:
        where.append("r.priority >= ?")
        params.append(min_priority)
    if book_node_id:
        from .resources import descendants
        node_ids = [book_node_id] + [n["id"] for n in descendants(db, book_node_id)]
        where.append(f"q.book_node_id IN ({placeholders(node_ids)})")
        params.extend(node_ids)
    if book_id:
        where.append("q.book_id = ?")
        params.append(book_id)
    if subject_id:
        where.append("(b.subject_id = ? OR t.subject_id = ?)")
        params.extend([subject_id, subject_id])
    if topic_id:
        ids = subtree_ids(db, topic_id)
        where.append(
            f"""(r.topic_id IN ({placeholders(ids)})
                 OR r.question_id IN (SELECT question_id FROM question_topic
                                       WHERE topic_id IN ({placeholders(ids)})))""")
        params.extend(ids + ids)
    if search:
        like = like_pattern(search)
        where.append("""(q.code LIKE ? ESCAPE '\\' OR q.display_number LIKE ? ESCAPE '\\'
                         OR t.title LIKE ? ESCAPE '\\')""")
        params.extend([like, like, like])
    clause = " AND ".join(where) if where else "1=1"
    base = f"""FROM review_item r
               LEFT JOIN question q ON q.id = r.question_id
               LEFT JOIN book b ON b.id = q.book_id
               LEFT JOIN book_node bn ON bn.id = q.book_node_id
               LEFT JOIN topic t ON t.id = r.topic_id
              WHERE {clause}"""
    total = db.scalar(f"SELECT COUNT(*) {base}", params, 0) or 0
    page = max(1, page)
    page_size = min(max(page_size, 1), 500)
    rows = db.query(
        f"""SELECT r.*, q.code, q.display_number, q.correct_answer, q.state AS question_state,
                   b.title AS book_title, bn.title AS node_title,
                   t.title AS topic_title,
                   (SELECT COUNT(*) FROM question_attempt a
                     WHERE a.question_id = r.question_id AND a.state='active') AS attempt_count,
                   (SELECT a.attempted_at FROM question_attempt a
                     WHERE a.question_id = r.question_id AND a.state='active'
                     ORDER BY a.attempted_at DESC, a.id DESC LIMIT 1) AS last_attempt_at,
                   (SELECT a.result FROM question_attempt a
                     WHERE a.question_id = r.question_id AND a.state='active'
                     ORDER BY a.attempted_at DESC, a.id DESC LIMIT 1) AS last_result
                   {base}
             ORDER BY r.priority DESC, last_attempt_at IS NOT NULL, last_attempt_at, r.id
             LIMIT ? OFFSET ?""",
        params + [page_size, (page - 1) * page_size])
    items = [_decode_item(row) for row in rows]
    if reasons:
        wanted = set(reasons)
        items = [item for item in items if wanted & set(item["reasons"])]
    for item in items:
        if item.get("topic_id"):
            item["topic_path"] = topic_path(db, item["topic_id"])
    return paginate(items, page, page_size, total)


def review_summary(db: Database, sync: bool = True) -> dict:
    if sync:
        sync_all(db)
    rows = db.query(
        """SELECT reasons, COUNT(*) AS cnt FROM review_item
            WHERE state IN ('open','in_progress') GROUP BY reasons""")
    by_reason: dict[str, int] = {reason: 0 for reason in REVIEW_REASONS}
    total = 0
    for row in rows:
        total += row["cnt"]
        for reason in loads(row["reasons"], []) or []:
            by_reason[reason] = by_reason.get(reason, 0) + row["cnt"]
    levels = db.query_one(
        """SELECT SUM(CASE WHEN question_id IS NOT NULL THEN 1 ELSE 0 END) AS question_items,
                  SUM(CASE WHEN question_id IS NULL THEN 1 ELSE 0 END) AS topic_items
             FROM review_item WHERE state IN ('open','in_progress')""") or {}
    states = {row["state"]: row["cnt"] for row in db.query(
        "SELECT state, COUNT(*) AS cnt FROM review_item GROUP BY state")}
    return {"open_items": total, "by_reason": by_reason, "states": states,
            "question_items": levels.get("question_items") or 0,
            "topic_items": levels.get("topic_items") or 0}


# ---------------------------------------------------------------------------
# فیلترهای زنده روی بانک تست (ترکیب آزاد معیارها)
# ---------------------------------------------------------------------------

LIVE_FILTERS = {
    "incorrect": "آخرین تلاش غلط",
    "unanswered": "آخرین تلاش بی‌پاسخ",
    "ever_incorrect": "شامل تست‌هایی که قبلاً غلط بوده‌اند",
    "ever_unanswered": "شامل تست‌هایی که قبلاً بی‌پاسخ بوده‌اند",
    "incorrect_previous": "غلط در سابقه قبلی",
    "unanswered_previous": "بی‌پاسخ در سابقه قبلی",
    "important": "علامت مهم",
    "hard": "علامت سخت",
    "never_correct": "هرگز درست زده نشده",
    "untried": "هنوز حل نشده",
    "goal_remaining": "باقی‌مانده از هدف مبحث",
    "upcoming_exam": "مرتبط با آزمون آینده",
}


def _live_filter_clause(key: str) -> tuple[str, list[Any]]:
    if key == "incorrect":
        return """(SELECT a.result FROM question_attempt a
                    WHERE a.question_id=q.id AND a.state='active'
                    ORDER BY a.attempted_at DESC, a.id DESC LIMIT 1) = 'incorrect'""", []
    if key == "unanswered":
        return """(SELECT a.result FROM question_attempt a
                    WHERE a.question_id=q.id AND a.state='active'
                    ORDER BY a.attempted_at DESC, a.id DESC LIMIT 1) = 'unanswered'""", []
    if key == "ever_incorrect":
        return """EXISTS (SELECT 1 FROM question_attempt a
                           WHERE a.question_id=q.id AND a.state='active'
                             AND a.result='incorrect')""", []
    if key == "ever_unanswered":
        return """EXISTS (SELECT 1 FROM question_attempt a
                           WHERE a.question_id=q.id AND a.state='active'
                             AND a.result='unanswered')""", []
    if key == "incorrect_previous":
        return """EXISTS (SELECT 1 FROM previous_question_entry p
                           WHERE p.question_id=q.id AND p.state='active'
                             AND p.result='incorrect')""", []
    if key == "unanswered_previous":
        return """EXISTS (SELECT 1 FROM previous_question_entry p
                           WHERE p.question_id=q.id AND p.state='active'
                             AND p.result='unanswered')""", []
    if key == "important":
        return "EXISTS (SELECT 1 FROM user_question_flag f WHERE f.question_id=q.id AND f.important=1)", []
    if key == "hard":
        return "EXISTS (SELECT 1 FROM user_question_flag f WHERE f.question_id=q.id AND f.hard=1)", []
    if key == "never_correct":
        return """(NOT EXISTS (SELECT 1 FROM question_attempt a
                                WHERE a.question_id=q.id AND a.state='active'
                                  AND a.result='correct')
                   AND NOT EXISTS (SELECT 1 FROM previous_question_entry p
                                    WHERE p.question_id=q.id AND p.state='active'
                                      AND p.result='correct'))""", []
    if key == "untried":
        return """(NOT EXISTS (SELECT 1 FROM question_attempt a
                                WHERE a.question_id=q.id AND a.state='active')
                   AND NOT EXISTS (SELECT 1 FROM previous_question_entry p
                                    WHERE p.question_id=q.id AND p.state='active'))""", []
    if key == "goal_remaining":
        return """EXISTS (SELECT 1 FROM question_topic qt
                            JOIN teaching_test_goal g ON g.topic_id = qt.topic_id
                                 AND g.status='active'
                           WHERE qt.question_id = q.id
                             AND (SELECT COUNT(DISTINCT a.question_id)
                                    FROM question_attempt a
                                    JOIN question_topic qt2 ON qt2.question_id = a.question_id
                                   WHERE qt2.topic_id = g.topic_id AND a.state='active')
                                 < g.target_count)""", []
    if key == "upcoming_exam":
        return """EXISTS (SELECT 1 FROM question_topic qt
                            JOIN future_exam_plan_topic pt ON pt.topic_id = qt.topic_id
                            JOIN future_exam_plan p ON p.id = pt.plan_id
                                 AND p.preparation_status <> 'done'
                                 AND (p.exam_date IS NULL OR p.exam_date >= ?)
                           WHERE qt.question_id = q.id)""", [today_iso()]
    raise ApiError(f"فیلتر ناشناخته: {key}", 422, {"filters": f"کلید نامعتبر: {key}"})


def filtered_questions(db: Database, filters: list[str], *, match_all: bool = False,
                       subject_id: int | None = None, book_id: int | None = None,
                       topic_id: int | None = None, book_node_id: int | None = None,
                       limit: int = 200, offset: int = 0) -> dict:
    """فیلتر زنده روی کل بانک؛ چند معیار با «یا» یا «و» ترکیب می‌شود."""
    if not filters:
        raise ApiError("حداقل یک معیار مرور لازم است", 422, {"filters": "خالی است"})
    clauses: list[str] = []
    params: list[Any] = []
    for key in filters:
        clause, extra = _live_filter_clause(key)
        clauses.append(f"({clause})")
        params.extend(extra)
    joiner = " AND " if match_all else " OR "
    where = [f"q.state='active'", f"({joiner.join(clauses)})"]
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
        ids = subtree_ids(db, topic_id)
        where.append(f"""q.id IN (SELECT question_id FROM question_topic
                                   WHERE topic_id IN ({placeholders(ids)}))""")
        params.extend(ids)
    clause = " AND ".join(where)
    total = db.scalar(
        f"""SELECT COUNT(*) FROM question q LEFT JOIN book b ON b.id = q.book_id
             WHERE {clause}""", params, 0) or 0
    rows = db.query(
        f"""SELECT q.*, q.id AS question_id, b.title AS book_title, bn.title AS node_title,
                   f.important, f.hard,
                   (SELECT a.result FROM question_attempt a
                     WHERE a.question_id=q.id AND a.state='active'
                     ORDER BY a.attempted_at DESC, a.id DESC LIMIT 1) AS last_result,
                   (SELECT MAX(a.attempted_at) FROM question_attempt a
                     WHERE a.question_id=q.id AND a.state='active') AS last_attempt_at,
                   (SELECT COUNT(*) FROM question_attempt a
                     WHERE a.question_id=q.id AND a.state='active') AS attempt_count
              FROM question q
              LEFT JOIN book b ON b.id = q.book_id
              LEFT JOIN book_node bn ON bn.id = q.book_node_id
              LEFT JOIN user_question_flag f ON f.question_id = q.id
             WHERE {clause}
             ORDER BY (last_attempt_at IS NOT NULL), last_attempt_at, q.id
             LIMIT ? OFFSET ?""",
        params + [min(max(limit, 1), 1000), max(offset, 0)])
    return {"filters": filters, "match_all": match_all, "total": total,
            "items": rows, "count": len(rows), "limit": limit, "offset": offset}


# ---------------------------------------------------------------------------
# مدیریت دستی موارد مرور
# ---------------------------------------------------------------------------

def add_item(db: Database, data: dict) -> dict:
    question_id = as_id(data.get("question_id"), "question_id")
    topic_id = as_id(data.get("topic_id"), "topic_id")
    if not question_id and not topic_id:
        raise ApiError("مورد مرور باید به یک تست یا یک مبحث متصل باشد", 422,
                       {"question_id": "شناسه تست یا مبحث لازم است"})
    if question_id:
        if not db.scalar("SELECT 1 FROM question WHERE id = ?", (question_id,)):
            raise NotFound("تست یافت نشد")
        existing = db.query_one(
            """SELECT * FROM review_item WHERE question_id = ?
                AND state IN ('open','in_progress') LIMIT 1""", (question_id,))
    else:
        if not db.scalar("SELECT 1 FROM topic WHERE id = ?", (topic_id,)):
            raise NotFound("مبحث یافت نشد")
        existing = db.query_one(
            """SELECT * FROM review_item WHERE topic_id = ? AND question_id IS NULL
                AND state IN ('open','in_progress') LIMIT 1""", (topic_id,))
    reasons = data.get("reasons") or ["manual"]
    reasons = [as_choice(r, REVIEW_REASONS, "reasons") for r in reasons]
    if existing:
        merged = sorted(set(loads(existing["reasons"], []) or []) | set(reasons))
        db.update("review_item", existing["id"], {
            "reasons": dumps(merged),
            "priority": max(existing["priority"], compute_priority(merged)),
            "note": clean(data.get("note")) or existing["note"],
            "updated_at": utc_now(),
        })
        return get_item(db, existing["id"])
    item_id = db.insert("review_item", {
        "question_id": question_id,
        "topic_id": topic_id if not question_id else None,
        "reasons": dumps(reasons),
        "priority": compute_priority(reasons),
        "state": "open",
        "origin": "manual",
        "note": clean(data.get("note")),
        "created_at": utc_now(),
        "updated_at": utc_now(),
    })
    return get_item(db, item_id)


def get_item(db: Database, item_id: int) -> dict:
    row = db.query_one(
        """SELECT r.*, q.code, q.display_number, t.title AS topic_title
             FROM review_item r
             LEFT JOIN question q ON q.id = r.question_id
             LEFT JOIN topic t ON t.id = r.topic_id
            WHERE r.id = ?""", (item_id,))
    if not row:
        raise NotFound("مورد مرور یافت نشد")
    return _decode_item(row)


def update_item(db: Database, item_id: int, data: dict) -> dict:
    get_item(db, item_id)
    updates: dict[str, Any] = {"updated_at": utc_now()}
    if "state" in data:
        state = as_choice(data["state"], REVIEW_STATES, "state", allow_none=False)
        updates["state"] = state
        updates["resolved_at"] = utc_now() if state in ("resolved", "archived") else None
    if "priority" in data:
        updates["priority"] = as_int(data["priority"], "priority", allow_none=True) or 0
    if "note" in data:
        updates["note"] = clean(data["note"])
    if "reasons" in data and data["reasons"]:
        updates["reasons"] = dumps([as_choice(r, REVIEW_REASONS, "reasons")
                                    for r in data["reasons"]])
    db.update("review_item", item_id, updates)
    return get_item(db, item_id)


def remove_reason(db: Database, item_id: int, reason: str) -> dict:
    item = get_item(db, item_id)
    reasons = [r for r in item["reasons"] if r != reason]
    if item["origin"] == "auto" and not reasons:
        # با حذف آخرین دلیل خودکار، مورد مرور بسته می‌شود
        return update_item(db, item_id, {"state": "resolved"})
    return update_item(db, item_id, {"reasons": reasons or ["manual"]})


def study_batch(db: Database, filters: list[str] | None = None, limit: int = 20,
                *, subject_id: int | None = None, book_id: int | None = None,
                topic_id: int | None = None, group_by: str = "priority") -> dict:
    """دسته کار پیشنهادی برای مرور امروز، مرتب‌شده بر پایه اولویت و قدمت."""
    filters = filters or ["incorrect", "unanswered", "important"]
    result = filtered_questions(db, filters, match_all=False, subject_id=subject_id,
                                book_id=book_id, topic_id=topic_id, limit=limit)
    items = result["items"]
    for item in items:
        reasons = []
        if item["last_result"] == "incorrect":
            reasons.append("incorrect")
        elif item["last_result"] == "unanswered":
            reasons.append("unanswered")
        if item.get("important"):
            reasons.append("important")
        if item.get("hard"):
            reasons.append("hard")
        item["reasons"] = reasons or ["untried"]
        item["priority"] = compute_priority(item["reasons"])
    items.sort(key=lambda row: (-row["priority"], row["last_attempt_at"] or "0000"))
    return {"filters": filters, "count": len(items), "items": items,
            "total_matching": result["total"]}
