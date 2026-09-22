"""ماژول ۲ — ساختار مباحث آموزشی (کاملاً مستقل از ساختار فیزیکی کتاب).

قاعده ۳ سند ۰۴: Topic نشان می‌دهد تست از نظر آموزشی به چه مبحثی مربوط است و
نباید با BookNode ادغام شود. اتصال تست به مبحث چندبه‌چند است (قاعده ۴).
"""
from __future__ import annotations

from typing import Any

from ..config import TOPIC_RELATION_TYPES, TOPIC_STATUSES
from ..core import (ApiError, Conflict, NotFound, as_choice, as_id, as_int,
                    clean, like_pattern, require)
from ..db import Database, placeholders, utc_now


def _row(db: Database, topic_id: int) -> dict:
    row = db.query_one("SELECT * FROM topic WHERE id = ?", (topic_id,))
    if not row:
        raise NotFound("مبحث آموزشی یافت نشد")
    return row


def get_topic(db: Database, topic_id: int) -> dict:
    topic = _row(db, topic_id)
    topic["path"] = topic_path(db, topic_id)
    return topic


def list_topics(db: Database, subject_id: int | None = None,
                include_archived: bool = False, search: str | None = None,
                status: str | None = None) -> list[dict]:
    sql = """SELECT t.*, s.name AS subject_name, p.title AS parent_title,
                    (SELECT COUNT(*) FROM question_topic qt
                       JOIN question q ON q.id = qt.question_id AND q.state='active'
                      WHERE qt.topic_id = t.id) AS question_count
             FROM topic t
             LEFT JOIN subject s ON s.id = t.subject_id
             LEFT JOIN topic p ON p.id = t.parent_id
             WHERE 1=1"""
    params: list[Any] = []
    if subject_id:
        sql += " AND t.subject_id = ?"
        params.append(subject_id)
    if not include_archived:
        sql += " AND t.status <> 'archived'"
    if status:
        sql += " AND t.status = ?"
        params.append(status)
    if search:
        sql += " AND t.title LIKE ? ESCAPE '\\'"
        params.append(like_pattern(search))
    sql += " ORDER BY t.order_index, t.title"
    rows = db.query(sql, params)
    for row in rows:
        row["path"] = topic_path(db, row["id"])
    return rows


def get_topic_tree(db: Database, subject_id: int | None = None,
                   include_archived: bool = False) -> list[dict]:
    sql = "SELECT * FROM topic WHERE 1=1"
    params: list[Any] = []
    if subject_id:
        sql += " AND subject_id = ?"
        params.append(subject_id)
    if not include_archived:
        sql += " AND status <> 'archived'"
    sql += " ORDER BY order_index, id"
    rows = db.query(sql, params)
    counts = {r["topic_id"]: r for r in db.query(
        """SELECT qt.topic_id, COUNT(*) AS question_count
             FROM question_topic qt JOIN question q ON q.id = qt.question_id AND q.state='active'
            GROUP BY qt.topic_id""")}
    goals = {r["topic_id"]: r for r in db.query(
        """SELECT topic_id, SUM(target_count) AS target_count
             FROM teaching_test_goal WHERE status='active' GROUP BY topic_id""")}
    taught = {r["topic_id"]: r for r in db.query("SELECT * FROM teaching_unit")}
    branches: dict[int | None, list[dict]] = {}
    for row in rows:
        row["question_count"] = counts.get(row["id"], {}).get("question_count", 0)
        row["target_count"] = goals.get(row["id"], {}).get("target_count", 0)
        row["taught_status"] = taught.get(row["id"], {}).get("taught_status", "not_started")
        row["children"] = []
        branches.setdefault(row["parent_id"], []).append(row)

    def attach(parent_id: int | None) -> list[dict]:
        for node in branches.get(parent_id, []):
            node["children"] = attach(node["id"])
            node["total_question_count"] = node["question_count"] + sum(
                c["total_question_count"] for c in node["children"])
            node["total_target_count"] = node["target_count"] + sum(
                c["total_target_count"] for c in node["children"])
        return branches.get(parent_id, [])

    return attach(None)


def create_topic(db: Database, data: dict) -> dict:
    require(data, ["title"])
    subject_id = as_id(data.get("subject_id"), "subject_id")
    parent_id = as_id(data.get("parent_id"), "parent_id")
    if parent_id:
        parent = _row(db, parent_id)
        if subject_id and parent["subject_id"] and parent["subject_id"] != subject_id:
            raise ApiError("مبحث والد به درس دیگری تعلق دارد", 422,
                           {"parent_id": "درس والد و فرزند باید یکی باشد"})
        subject_id = subject_id or parent["subject_id"]
    status = as_choice(data.get("status"), TOPIC_STATUSES, "status", allow_none=True,
                       default="active")
    order_index = as_int(data.get("order_index"), "order_index", allow_none=True)
    if order_index is None:
        order_index = db.scalar(
            "SELECT IFNULL(MAX(order_index), 0) + 1 FROM topic "
            "WHERE IFNULL(parent_id,0) = ? AND IFNULL(subject_id,0) = ?",
            (parent_id or 0, subject_id or 0), 1) or 1
    with db.write() as cur:
        cur.execute(
            """INSERT INTO topic(subject_id, parent_id, title, status, order_index,
                                 notes, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (subject_id, parent_id, clean(data["title"]), status, order_index,
             clean(data.get("notes")), utc_now()),
        )
        topic_id = int(cur.lastrowid)
    return get_topic(db, topic_id)


def update_topic(db: Database, topic_id: int, data: dict) -> dict:
    topic = _row(db, topic_id)
    updates: dict[str, Any] = {}
    if "title" in data:
        title = clean(data["title"])
        if not title:
            raise ApiError("عنوان مبحث نمی‌تواند خالی باشد", 422, {"title": "الزامی"})
        updates["title"] = title
    if "status" in data:
        updates["status"] = as_choice(data["status"], TOPIC_STATUSES, "status",
                                      allow_none=False)
    if "notes" in data:
        updates["notes"] = clean(data["notes"])
    if "subject_id" in data:
        updates["subject_id"] = as_id(data["subject_id"], "subject_id")
    if "order_index" in data:
        updates["order_index"] = as_int(data["order_index"], "order_index", True) or 0
    if "parent_id" in data:
        parent_id = as_id(data["parent_id"], "parent_id")
        if parent_id == topic_id:
            raise ApiError("مبحث نمی‌تواند والد خودش باشد", 422, {"parent_id": "نامعتبر"})
        if parent_id:
            _row(db, parent_id)
            # والد جدید نباید از زیرشاخه‌های همین مبحث باشد (جلوگیری از حلقه)
            if parent_id in [t["id"] for t in descendants(db, topic_id)]:
                raise ApiError("جابه‌جایی باعث ایجاد حلقه می‌شود", 422,
                               {"parent_id": "این والد از زیرشاخه‌های همین مبحث است"})
        updates["parent_id"] = parent_id
    if updates:
        db.update("topic", topic_id, updates)
    return get_topic(db, topic_id)


def descendants(db: Database, topic_id: int) -> list[dict]:
    return db.query(
        """WITH RECURSIVE sub(id) AS (
               SELECT id FROM topic WHERE parent_id = ?
               UNION ALL
               SELECT t.id FROM topic t JOIN sub ON t.parent_id = sub.id)
           SELECT t.* FROM topic t JOIN sub ON sub.id = t.id""",
        (topic_id,),
    )


def subtree_ids(db: Database, topic_id: int, include_self: bool = True) -> list[int]:
    ids = [t["id"] for t in descendants(db, topic_id)]
    if include_self:
        ids.insert(0, topic_id)
    return ids


def delete_topic(db: Database, topic_id: int, hard: bool = False) -> dict:
    _row(db, topic_id)
    links = db.scalar("SELECT COUNT(*) FROM question_topic WHERE topic_id = ?", (topic_id,), 0)
    kids = db.scalar("SELECT COUNT(*) FROM topic WHERE parent_id = ?", (topic_id,), 0)
    history = db.scalar(
        """SELECT (SELECT COUNT(*) FROM review_item WHERE topic_id = ?)
                + (SELECT COUNT(*) FROM exam_topic WHERE topic_id = ?)
                + (SELECT COUNT(*) FROM teaching_test_goal WHERE topic_id = ?)""",
        (topic_id, topic_id, topic_id), 0)
    if links or kids or history:
        db.execute("UPDATE topic SET status='archived' WHERE id = ?", (topic_id,))
        return {"archived": True,
                "reason": "مبحث دارای داده مرتبط است و به‌جای حذف آرشیو شد",
                "usage": {"question_links": links, "children": kids, "other": history}}
    if hard:
        with db.write() as cur:
            cur.execute("DELETE FROM teaching_unit WHERE topic_id = ?", (topic_id,))
            cur.execute("DELETE FROM topic WHERE id = ?", (topic_id,))
        return {"deleted": True}
    db.execute("UPDATE topic SET status='archived' WHERE id = ?", (topic_id,))
    return {"archived": True}


def topic_path(db: Database, topic_id: int) -> str:
    parts: list[str] = []
    current = db.query_one("SELECT id, title, parent_id FROM topic WHERE id = ?", (topic_id,))
    guard = 0
    while current and guard < 20:
        parts.append(current["title"])
        current = (db.query_one("SELECT id, title, parent_id FROM topic WHERE id = ?",
                                (current["parent_id"],))
                   if current["parent_id"] else None)
        guard += 1
    return " › ".join(reversed(parts))


# ---------------------------------------------------------------------------
# اتصال تست و مبحث (QuestionTopic)
# ---------------------------------------------------------------------------

def attach_questions(db: Database, topic_id: int, question_ids: list[int],
                     relation_type: str = "primary") -> dict:
    _row(db, topic_id)
    relation_type = as_choice(relation_type, TOPIC_RELATION_TYPES, "relation_type",
                              allow_none=False)
    if not question_ids:
        raise ApiError("فهرست تست‌ها خالی است", 422, {"question_ids": "حداقل یک تست لازم است"})
    created, skipped = 0, 0
    with db.write() as cur:
        for question_id in question_ids:
            exists = cur.execute("SELECT 1 FROM question WHERE id = ?", (question_id,)).fetchone()
            if not exists:
                skipped += 1
                continue
            try:
                cur.execute(
                    """INSERT INTO question_topic(question_id, topic_id, relation_type, created_at)
                       VALUES (?, ?, ?, ?)""",
                    (question_id, topic_id, relation_type, utc_now()),
                )
                created += 1
            except Exception:
                skipped += 1
    return {"created": created, "skipped": skipped, "relation_type": relation_type}


def detach_question(db: Database, topic_id: int, question_id: int) -> dict:
    removed = db.execute(
        "DELETE FROM question_topic WHERE topic_id = ? AND question_id = ?",
        (topic_id, question_id)).rowcount
    if not removed:
        raise NotFound("این تست به این مبحث متصل نبود")
    return {"removed": removed}


def topic_questions(db: Database, topic_id: int, include_subtopics: bool = False) -> list[dict]:
    ids = subtree_ids(db, topic_id) if include_subtopics else [topic_id]
    rows = db.query(
        f"""SELECT q.*, qt.relation_type, qt.topic_id,
                   b.title AS book_title, bn.title AS node_title
              FROM question_topic qt
              JOIN question q ON q.id = qt.question_id
              LEFT JOIN book b ON b.id = q.book_id
              LEFT JOIN book_node bn ON bn.id = q.book_node_id
             WHERE qt.topic_id IN ({placeholders(ids)}) AND q.state='active'
             ORDER BY q.id""",
        ids,
    )
    return rows


def topic_stats(db: Database, topic_id: int, include_subtopics: bool = True) -> dict:
    """آمار مبحث از داده خام (قاعده ۱۰) — بدون هیچ مقدار ذخیره‌شده جایگزین."""
    ids = subtree_ids(db, topic_id) if include_subtopics else [topic_id]
    marks = placeholders(ids)
    question_count = db.scalar(
        f"""SELECT COUNT(DISTINCT qt.question_id) FROM question_topic qt
             JOIN question q ON q.id = qt.question_id AND q.state='active'
            WHERE qt.topic_id IN ({marks})""", ids, 0)
    attempt_count = db.scalar(
        f"""SELECT COUNT(*) FROM question_attempt a
             JOIN question_topic qt ON qt.question_id = a.question_id
            WHERE qt.topic_id IN ({marks})""", ids, 0)
    previous_count = db.scalar(
        f"""SELECT COUNT(*) FROM previous_question_entry p
             JOIN question_topic qt ON qt.question_id = p.question_id
            WHERE qt.topic_id IN ({marks})""", ids, 0)
    touched = db.scalar(
        f"""SELECT COUNT(DISTINCT q.id) FROM question q
             JOIN question_topic qt ON qt.question_id = q.id
            WHERE qt.topic_id IN ({marks})
              AND EXISTS (SELECT 1 FROM question_attempt a WHERE a.question_id = q.id)""",
        ids, 0)
    results = {
        row["result"]: row["cnt"] for row in db.query(
            f"""SELECT a.result, COUNT(*) AS cnt FROM question_attempt a
                 JOIN question_topic qt ON qt.question_id = a.question_id
                WHERE qt.topic_id IN ({marks}) GROUP BY a.result""", ids)
    }
    flags = db.query_one(
        f"""SELECT SUM(CASE WHEN f.important=1 THEN 1 ELSE 0 END) AS important,
                   SUM(CASE WHEN f.hard=1 THEN 1 ELSE 0 END) AS hard
              FROM user_question_flag f
              JOIN question_topic qt ON qt.question_id = f.question_id
             WHERE qt.topic_id IN ({marks})""", ids) or {}
    open_reviews = db.scalar(
        f"""SELECT COUNT(*) FROM review_item r
             WHERE r.state IN ('open','in_progress')
               AND (r.topic_id IN ({marks})
                    OR r.question_id IN (SELECT question_id FROM question_topic
                                          WHERE topic_id IN ({marks})))""",
        ids + ids, 0)
    goal = db.scalar(
        f"""SELECT SUM(target_count) FROM teaching_test_goal
             WHERE topic_id IN ({marks}) AND status='active'""", ids, 0) or 0
    teaching = db.query_one(
        """SELECT * FROM teaching_unit WHERE topic_id = ?""", (topic_id,)) or {}
    done = db.scalar(
        f"""SELECT COUNT(DISTINCT a.question_id) FROM question_attempt a
             JOIN question_topic qt ON qt.question_id = a.question_id
            WHERE qt.topic_id IN ({marks})""", ids, 0)
    return {
        "topic_id": topic_id,
        "question_count": question_count,
        "attempt_count": attempt_count,
        "previous_entry_count": previous_count,
        "solved_questions": touched or 0,
        "distinct_attempted": done or 0,
        "correct": results.get("correct", 0),
        "incorrect": results.get("incorrect", 0),
        "unanswered": results.get("unanswered", 0),
        "important_count": flags.get("important") or 0,
        "hard_count": flags.get("hard") or 0,
        "open_review_items": open_reviews,
        "target_count": goal,
        "remaining_to_target": max(0, (goal or 0) - (touched or 0)),
        "taught_status": teaching.get("taught_status", "not_started"),
        "taught_at": teaching.get("taught_at"),
    }


def ensure_topics_exist(db: Database, topic_ids: list[int]) -> list[int]:
    if not topic_ids:
        return []
    rows = db.query(
        f"SELECT id FROM topic WHERE id IN ({placeholders(topic_ids)})", topic_ids)
    found = {r["id"] for r in rows}
    missing = [t for t in topic_ids if t not in found]
    if missing:
        raise Conflict(f"مبحث‌های یافت‌نشده: {missing}")
    return sorted(found)
