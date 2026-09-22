"""ماژول ۶ — مدیریت تدریس و عقب‌ماندگی.

برای هر مبحث/واحد آموزشی: وضعیت تدریس، هدف تعداد تست، تعداد انجام‌شده،
باقی‌مانده و عقب‌ماندگی (بند ۹ سند ۰۱).
"""
from __future__ import annotations

from typing import Any

from ..config import TAUGHT_STATUSES
from ..core import (ApiError, NotFound, as_choice, as_id, as_int, clean, paginate,
                    parse_date_only, parse_when, require)
from ..db import Database, placeholders, utc_now
from .topics import subtree_ids, topic_path


def _topic(db: Database, topic_id: int) -> dict:
    row = db.query_one("SELECT * FROM topic WHERE id = ?", (topic_id,))
    if not row:
        raise NotFound("مبحث آموزشی یافت نشد")
    return row


# ---------------------------------------------------------------------------
# وضعیت تدریس
# ---------------------------------------------------------------------------

def set_teaching_status(db: Database, topic_id: int, data: dict) -> dict:
    _topic(db, topic_id)
    status = as_choice(data.get("taught_status"), TAUGHT_STATUSES, "taught_status",
                       allow_none=False)
    taught_at = (parse_when(data.get("taught_at"), required=False)
                 if data.get("taught_at") else None)
    if status in ("taught", "needs_review") and not taught_at:
        existing = db.query_one("SELECT taught_at FROM teaching_unit WHERE topic_id = ?",
                                (topic_id,))
        taught_at = (existing or {}).get("taught_at") or utc_now()
    with db.write() as cur:
        cur.execute(
            """INSERT INTO teaching_unit(topic_id, taught_status, taught_at, notes, updated_at)
               VALUES (?, ?, ?, ?, ?)
               ON CONFLICT(topic_id) DO UPDATE SET
                   taught_status = excluded.taught_status,
                   taught_at = COALESCE(excluded.taught_at, teaching_unit.taught_at),
                   notes = COALESCE(excluded.notes, teaching_unit.notes),
                   updated_at = excluded.updated_at""",
            (topic_id, status, taught_at, clean(data.get("notes")), utc_now()))
    return get_teaching_unit(db, topic_id)


def get_teaching_unit(db: Database, topic_id: int) -> dict:
    topic = _topic(db, topic_id)
    row = db.query_one("SELECT * FROM teaching_unit WHERE topic_id = ?", (topic_id,))
    if not row:
        row = {"topic_id": topic_id, "taught_status": "not_started", "taught_at": None,
               "notes": None, "updated_at": None}
    row["topic_title"] = topic["title"]
    row["topic_path"] = topic_path(db, topic_id)
    row["progress"] = goal_progress(db, topic_id)
    return row


def list_teaching_units(db: Database, subject_id: int | None = None,
                        status: str | None = None) -> list[dict]:
    where = ["t.status <> 'archived'"]
    params: list[Any] = []
    if subject_id:
        where.append("t.subject_id = ?")
        params.append(subject_id)
    if status:
        where.append("IFNULL(tu.taught_status,'not_started') = ?")
        params.append(status)
    rows = db.query(
        f"""SELECT t.id AS topic_id, t.title, t.status AS topic_status,
                   IFNULL(tu.taught_status, 'not_started') AS taught_status,
                   tu.taught_at, tu.notes, tu.updated_at
              FROM topic t
              LEFT JOIN teaching_unit tu ON tu.topic_id = t.id
             WHERE {' AND '.join(where)}
             ORDER BY t.order_index, t.title""", params)
    for row in rows:
        row["topic_path"] = topic_path(db, row["topic_id"])
        row["progress"] = goal_progress(db, row["topic_id"])
    return rows


# ---------------------------------------------------------------------------
# هدف تعداد تست
# ---------------------------------------------------------------------------

def _goal_row(db: Database, goal_id: int) -> dict:
    row = db.query_one("SELECT * FROM teaching_test_goal WHERE id = ?", (goal_id,))
    if not row:
        raise NotFound("هدف تست یافت نشد")
    return row


def create_goal(db: Database, data: dict) -> dict:
    require(data, ["topic_id", "target_count"])
    topic_id = as_int(data["topic_id"], "topic_id")
    _topic(db, topic_id)
    target = as_int(data["target_count"], "target_count")
    if target is None or target < 0:
        raise ApiError("هدف تعداد تست باید عددی نامنفی باشد", 422,
                       {"target_count": "عدد نامعتبر"})
    goal_id = db.insert("teaching_test_goal", {
        "topic_id": topic_id,
        "target_count": target,
        "period_label": clean(data.get("period_label")),
        "period_start": parse_date_only(data.get("period_start")),
        "period_end": parse_date_only(data.get("period_end")),
        "notes": clean(data.get("notes")),
        "status": "active",
        "created_at": utc_now(),
        "updated_at": utc_now(),
    })
    from .review import sync_topic_review
    sync_topic_review(db, topic_id)
    return get_goal(db, goal_id)


def get_goal(db: Database, goal_id: int) -> dict:
    goal = _goal_row(db, goal_id)
    goal["topic_path"] = topic_path(db, goal["topic_id"])
    goal["progress"] = goal_progress(db, goal["topic_id"])
    return goal


def list_goals(db: Database, topic_id: int | None = None, subject_id: int | None = None,
               status: str = "active") -> list[dict]:
    where = []
    params: list[Any] = []
    if topic_id:
        ids = subtree_ids(db, topic_id)
        where.append(f"g.topic_id IN ({placeholders(ids)})")
        params.extend(ids)
    if subject_id:
        where.append("t.subject_id = ?")
        params.append(subject_id)
    if status and status != "all":
        where.append("g.status = ?")
        params.append(status)
    clause = " AND ".join(where) if where else "1=1"
    rows = db.query(
        f"""SELECT g.*, t.title AS topic_title, t.subject_id
              FROM teaching_test_goal g JOIN topic t ON t.id = g.topic_id
             WHERE {clause} ORDER BY g.created_at DESC""", params)
    for row in rows:
        row["topic_path"] = topic_path(db, row["topic_id"])
        row["progress"] = goal_progress(db, row["topic_id"])
    return rows


def update_goal(db: Database, goal_id: int, data: dict) -> dict:
    goal = _goal_row(db, goal_id)
    updates: dict[str, Any] = {"updated_at": utc_now()}
    if "target_count" in data:
        target = as_int(data["target_count"], "target_count")
        if target is None or target < 0:
            raise ApiError("هدف تعداد تست باید عددی نامنفی باشد", 422,
                           {"target_count": "عدد نامعتبر"})
        updates["target_count"] = target
    for field in ("period_label", "notes"):
        if field in data:
            updates[field] = clean(data[field])
    for field in ("period_start", "period_end"):
        if field in data:
            updates[field] = parse_date_only(data[field])
    if "status" in data:
        updates["status"] = as_choice(data["status"], ["active", "done", "archived"],
                                      "status", allow_none=False)
    db.update("teaching_test_goal", goal_id, updates)
    from .review import sync_topic_review
    sync_topic_review(db, goal["topic_id"])
    return get_goal(db, goal_id)


def delete_goal(db: Database, goal_id: int) -> dict:
    goal = _goal_row(db, goal_id)
    db.update("teaching_test_goal", goal_id, {"status": "archived", "updated_at": utc_now()})
    from .review import sync_topic_review
    sync_topic_review(db, goal["topic_id"])
    return {"archived": True, "id": goal_id}


def goal_progress(db: Database, topic_id: int) -> dict:
    """پیشرفت هدف: انجام‌شده، باقی‌مانده و عقب‌ماندگی — محاسبه از داده خام (قاعده ۱۰)."""
    ids = subtree_ids(db, topic_id)
    marks = placeholders(ids)
    target = db.scalar(
        f"""SELECT SUM(target_count) FROM teaching_test_goal
             WHERE topic_id IN ({marks}) AND status='active'""", ids, 0) or 0
    done = db.scalar(
        f"""SELECT COUNT(DISTINCT a.question_id) FROM question_attempt a
             JOIN question_topic qt ON qt.question_id = a.question_id
            WHERE qt.topic_id IN ({marks}) AND a.state='active'""", ids, 0) or 0
    available = db.scalar(
        f"""SELECT COUNT(DISTINCT qt.question_id) FROM question_topic qt
             JOIN question q ON q.id = qt.question_id AND q.state='active'
            WHERE qt.topic_id IN ({marks})""", ids, 0) or 0
    remaining = max(0, target - done)
    return {
        "target_count": target,
        "done_count": done,
        "remaining_count": remaining,
        "available_questions": available,
        "progress_percent": round(done / target * 100, 1) if target else None,
        "shortage_of_questions": max(0, target - available),
        "lag": remaining,
        "is_behind": remaining > 0,
    }


def overview(db: Database, subject_id: int | None = None) -> dict:
    """نمای کلی تدریس: چند مبحث تدریس شده، عقب‌ماندگی کل، مباحث بحرانی."""
    units = list_teaching_units(db, subject_id=subject_id)
    totals = {"topics": len(units), "not_started": 0, "in_progress": 0,
              "taught": 0, "needs_review": 0, "target": 0, "done": 0, "remaining": 0}
    behind: list[dict] = []
    for unit in units:
        status = unit["taught_status"]
        if status in totals:
            totals[status] += 1
        progress = unit["progress"]
        totals["target"] += progress["target_count"]
        totals["done"] += progress["done_count"]
        totals["remaining"] += progress["remaining_count"]
        if progress["remaining_count"] > 0:
            behind.append({
                "topic_id": unit["topic_id"], "title": unit["title"],
                "topic_path": unit["topic_path"], "taught_status": status,
                "remaining": progress["remaining_count"],
                "target_count": progress["target_count"],
                "done_count": progress["done_count"],
                "progress_percent": progress["progress_percent"],
            })
    behind.sort(key=lambda row: (-row["remaining"], row["taught_status"]))
    totals["progress_percent"] = (round(totals["done"] / totals["target"] * 100, 1)
                                  if totals["target"] else None)
    return {"totals": totals, "behind": behind[:50], "behind_count": len(behind),
            "units": units}
