"""ماژول ۱ — مرکز منابع: درس‌ها، کتاب‌ها و ساختار انعطاف‌پذیر هر کتاب.

قاعده ۳ و ۵ سند ۰۴:
  BookNode فقط «محل قرار گرفتن تست در کتاب» را نشان می‌دهد. ساختار کتاب الزاماً
  معادل مبحث آموزشی نیست؛ بنابراین هیچ‌جای این ماژول Topic ساخته نمی‌شود و
  «آزمون چکاپ»، «آزمون جامع» و «تست‌های مخلوط» صرفاً گره ساختاری/ارزیابی‌اند.
"""
from __future__ import annotations

from typing import Any

from ..config import ASSESSMENT_NODE_TYPES, NODE_TYPES
from ..core import (ApiError, Conflict, NotFound, as_choice, as_id, as_int,
                    clean, like_pattern, require)
from ..db import Database, dumps, utc_now

# ---------------------------------------------------------------------------
# درس‌ها
# ---------------------------------------------------------------------------

def list_subjects(db: Database, include_archived: bool = False,
                  search: str | None = None) -> list[dict]:
    sql = """SELECT s.*,
                    (SELECT COUNT(*) FROM book b WHERE b.subject_id = s.id AND b.state='active') AS book_count,
                    (SELECT COUNT(*) FROM topic t WHERE t.subject_id = s.id AND t.status='active') AS topic_count,
                    (SELECT COUNT(*) FROM question q
                       JOIN book b2 ON b2.id = q.book_id
                      WHERE b2.subject_id = s.id AND q.state='active') AS question_count
             FROM subject s WHERE 1=1"""
    params: list[Any] = []
    if not include_archived:
        sql += " AND s.state = 'active'"
    if search:
        sql += " AND s.name LIKE ? ESCAPE '\\'"
        params.append(like_pattern(search))
    sql += " ORDER BY s.grade, s.name"
    return db.query(sql, params)


def get_subject(db: Database, subject_id: int) -> dict:
    row = db.query_one("SELECT * FROM subject WHERE id = ?", (subject_id,))
    if not row:
        raise NotFound("درس یافت نشد")
    return row


def create_subject(db: Database, data: dict) -> dict:
    require(data, ["name"])
    name = clean(data["name"])
    duplicate = db.query_one(
        "SELECT id FROM subject WHERE name = ? AND IFNULL(grade,'') = IFNULL(?,'')",
        (name, clean(data.get("grade"))),
    )
    if duplicate:
        raise Conflict("درسی با همین نام و پایه از قبل ثبت شده است")
    with db.write() as cur:
        cur.execute(
            """INSERT INTO subject(name, grade, field_of_study, color, notes, created_at)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (name, clean(data.get("grade")), clean(data.get("field_of_study")),
             clean(data.get("color")), clean(data.get("notes")), utc_now()),
        )
        subject_id = int(cur.lastrowid)
    return get_subject(db, subject_id)


def update_subject(db: Database, subject_id: int, data: dict) -> dict:
    get_subject(db, subject_id)
    fields = {
        "name": clean(data.get("name")) if "name" in data else None,
        "grade": clean(data.get("grade")) if "grade" in data else None,
        "field_of_study": clean(data.get("field_of_study")) if "field_of_study" in data else None,
        "color": clean(data.get("color")) if "color" in data else None,
        "notes": clean(data.get("notes")) if "notes" in data else None,
    }
    if "name" in data and not fields["name"]:
        raise ApiError("نام درس نمی‌تواند خالی باشد", 422, {"name": "این فیلد الزامی است"})
    updates = {k: v for k, v in fields.items() if k in data}
    if "state" in data:
        updates["state"] = as_choice(data["state"], ["active", "archived"], "state",
                                     allow_none=False)
    if updates:
        db.update("subject", subject_id, updates)
    return get_subject(db, subject_id)


def delete_subject(db: Database, subject_id: int, hard: bool = False) -> dict:
    get_subject(db, subject_id)
    book_count = db.scalar("SELECT COUNT(*) FROM book WHERE subject_id = ?", (subject_id,), 0)
    usage = {"books": book_count}
    if book_count:
        db.execute("UPDATE subject SET state='archived' WHERE id = ?", (subject_id,))
        return {"archived": True, "reason": "درس دارای کتاب است و به‌جای حذف آرشیو شد",
                "usage": usage}
    if hard:
        with db.write() as cur:
            cur.execute("DELETE FROM topic WHERE subject_id = ?", (subject_id,))
            cur.execute("DELETE FROM subject WHERE id = ?", (subject_id,))
        return {"deleted": True}
    db.execute("UPDATE subject SET state='archived' WHERE id = ?", (subject_id,))
    return {"archived": True, "usage": usage}


# ---------------------------------------------------------------------------
# کتاب‌ها
# ---------------------------------------------------------------------------

def list_books(db: Database, subject_id: int | None = None,
               include_archived: bool = False, search: str | None = None) -> list[dict]:
    sql = """SELECT b.*, s.name AS subject_name, s.grade AS subject_grade,
                    (SELECT COUNT(*) FROM book_node n
                      WHERE n.book_id = b.id AND n.state='active') AS node_count,
                    (SELECT COUNT(*) FROM question q
                      WHERE q.book_id = b.id AND q.state='active') AS question_count
             FROM book b LEFT JOIN subject s ON s.id = b.subject_id WHERE 1=1"""
    params: list[Any] = []
    if subject_id:
        sql += " AND b.subject_id = ?"
        params.append(subject_id)
    if not include_archived:
        sql += " AND b.state = 'active'"
    if search:
        sql += " AND (b.title LIKE ? ESCAPE '\\' OR b.publisher LIKE ? ESCAPE '\\')"
        params.extend([like_pattern(search), like_pattern(search)])
    sql += " ORDER BY s.name, b.title"
    return db.query(sql, params)


def get_book(db: Database, book_id: int) -> dict:
    row = db.query_one(
        """SELECT b.*, s.name AS subject_name FROM book b
           LEFT JOIN subject s ON s.id = b.subject_id WHERE b.id = ?""",
        (book_id,),
    )
    if not row:
        raise NotFound("کتاب یافت نشد")
    return row


def create_book(db: Database, data: dict) -> dict:
    require(data, ["title"])
    subject_id = as_id(data.get("subject_id"), "subject_id")
    if subject_id:
        get_subject(db, subject_id)
    with db.write() as cur:
        cur.execute(
            """INSERT INTO book(subject_id, publisher, title, grade, field_of_study,
                                edition_year, notes, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (subject_id, clean(data.get("publisher")), clean(data["title"]),
             clean(data.get("grade")), clean(data.get("field_of_study")),
             clean(data.get("edition_year")), clean(data.get("notes")), utc_now()),
        )
        book_id = int(cur.lastrowid)
    return get_book(db, book_id)


def update_book(db: Database, book_id: int, data: dict) -> dict:
    get_book(db, book_id)
    allowed = ["publisher", "title", "grade", "field_of_study", "edition_year", "notes"]
    updates = {f: clean(data[f]) for f in allowed if f in data}
    if "title" in data and not updates.get("title"):
        raise ApiError("عنوان کتاب نمی‌تواند خالی باشد", 422, {"title": "این فیلد الزامی است"})
    if "subject_id" in data:
        subject_id = as_id(data["subject_id"], "subject_id")
        if subject_id:
            get_subject(db, subject_id)
        updates["subject_id"] = subject_id
    if "state" in data:
        updates["state"] = as_choice(data["state"], ["active", "archived"], "state",
                                     allow_none=False)
    if updates:
        db.update("book", book_id, updates)
    return get_book(db, book_id)


def delete_book(db: Database, book_id: int, hard: bool = False) -> dict:
    get_book(db, book_id)
    nodes = db.scalar("SELECT COUNT(*) FROM book_node WHERE book_id = ?", (book_id,), 0)
    questions = db.scalar("SELECT COUNT(*) FROM question WHERE book_id = ?", (book_id,), 0)
    if nodes or questions:
        db.execute("UPDATE book SET state='archived' WHERE id = ?", (book_id,))
        return {"archived": True,
                "reason": "کتاب دارای ساختار یا تست است و به‌جای حذف آرشیو شد",
                "usage": {"nodes": nodes, "questions": questions}}
    if hard:
        db.execute("DELETE FROM book WHERE id = ?", (book_id,))
        return {"deleted": True}
    db.execute("UPDATE book SET state='archived' WHERE id = ?", (book_id,))
    return {"archived": True}


def _node_row(db: Database, node_id: int) -> dict:
    row = db.query_one("SELECT * FROM book_node WHERE id = ?", (node_id,))
    if not row:
        raise NotFound("گره ساختاری کتاب یافت نشد")
    return row


def get_node_tree(db: Database, book_id: int, include_archived: bool = False) -> dict:
    """درخت کامل ساختار کتاب همراه شمار تست هر گره (شمارش تجمعی)."""
    get_book(db, book_id)
    sql = "SELECT * FROM book_node WHERE book_id = ?"
    if not include_archived:
        sql += " AND state = 'active'"
    sql += " ORDER BY order_index, id"
    nodes = db.query(sql, (book_id,))
    direct = {row["id"]: row["cnt"] for row in db.query(
        """SELECT book_node_id AS id, COUNT(*) AS cnt FROM question
            WHERE book_id = ? AND book_node_id IS NOT NULL AND state='active'
            GROUP BY book_node_id""", (book_id,))}
    children: dict[int | None, list[dict]] = {}
    for node in nodes:
        node["question_count"] = direct.get(node["id"], 0)
        node["is_assessment"] = node["node_type"] in ASSESSMENT_NODE_TYPES
        node["children"] = []
        children.setdefault(node["parent_id"], []).append(node)

    def attach(parent_id: int | None) -> list[dict]:
        branch = children.get(parent_id, [])
        for node in branch:
            node["children"] = attach(node["id"])
            node["total_question_count"] = node["question_count"] + sum(
                child["total_question_count"] for child in node["children"])
        return branch

    return {"book": get_book(db, book_id), "tree": attach(None),
            "node_count": len(nodes)}


def create_node(db: Database, data: dict) -> dict:
    require(data, ["book_id", "node_type", "title"])
    book_id = as_int(data["book_id"], "book_id")
    get_book(db, book_id)
    node_type = as_choice(data["node_type"], NODE_TYPES, "node_type", allow_none=False)
    parent_id = as_id(data.get("parent_id"), "parent_id")
    if parent_id:
        parent = _node_row(db, parent_id)
        if parent["book_id"] != book_id:
            raise ApiError("گره والد به کتاب دیگری تعلق دارد", 422,
                           {"parent_id": "والد باید از همان کتاب باشد"})
    order_index = as_int(data.get("order_index"), "order_index", allow_none=True)
    if order_index is None:
        order_index = (db.scalar(
            "SELECT IFNULL(MAX(order_index), 0) + 1 FROM book_node "
            "WHERE book_id = ? AND IFNULL(parent_id, 0) = ?",
            (book_id, parent_id or 0), 1) or 1)
    with db.write() as cur:
        cur.execute(
            """INSERT INTO book_node(book_id, parent_id, node_type, title, order_index,
                                     notes, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (book_id, parent_id, node_type, clean(data["title"]), order_index,
             clean(data.get("notes")), utc_now()),
        )
        node_id = int(cur.lastrowid)
    return _node_row(db, node_id)


def update_node(db: Database, node_id: int, data: dict) -> dict:
    node = _node_row(db, node_id)
    updates: dict[str, Any] = {}
    if "title" in data:
        title = clean(data["title"])
        if not title:
            raise ApiError("عنوان گره نمی‌تواند خالی باشد", 422, {"title": "این فیلد الزامی است"})
        updates["title"] = title
    if "node_type" in data:
        updates["node_type"] = as_choice(data["node_type"], NODE_TYPES, "node_type",
                                        allow_none=False)
    if "notes" in data:
        updates["notes"] = clean(data["notes"])
    if "order_index" in data:
        updates["order_index"] = as_int(data["order_index"], "order_index", allow_none=True) or 0
    if "parent_id" in data:
        parent_id = as_id(data["parent_id"], "parent_id")
        if parent_id == node_id:
            raise ApiError("گره نمی‌تواند والد خودش باشد", 422, {"parent_id": "مقدار نامعتبر"})
        if parent_id:
            parent = _node_row(db, parent_id)
            if parent["book_id"] != node["book_id"]:
                raise ApiError("گره والد به کتاب دیگری تعلق دارد", 422, {"parent_id": "نامعتبر"})
            # والد جدید نباید از زیرشاخه‌های همین گره باشد (جلوگیری از حلقه)
            if parent_id in [n["id"] for n in descendants(db, node_id)]:
                raise ApiError("جابه‌جایی باعث ایجاد حلقه در ساختار می‌شود", 422,
                               {"parent_id": "این والد از زیرشاخه‌های همین گره است"})
            updates["parent_id"] = parent_id
        else:
            updates["parent_id"] = None
    if "state" in data:
        updates["state"] = as_choice(data["state"], ["active", "archived"], "state",
                                     allow_none=False)
    if updates:
        db.update("book_node", node_id, updates)
    return _node_row(db, node_id)


def descendants(db: Database, node_id: int) -> list[dict]:
    rows = db.query(
        """WITH RECURSIVE sub(id) AS (
               SELECT id FROM book_node WHERE parent_id = ?
               UNION ALL
               SELECT n.id FROM book_node n JOIN sub ON n.parent_id = sub.id)
           SELECT n.* FROM book_node n JOIN sub ON sub.id = n.id""",
        (node_id,),
    )
    return rows


def delete_node(db: Database, node_id: int, hard: bool = False) -> dict:
    node = _node_row(db, node_id)
    kids = db.scalar("SELECT COUNT(*) FROM book_node WHERE parent_id = ?", (node_id,), 0)
    questions = db.scalar("SELECT COUNT(*) FROM question WHERE book_node_id = ?", (node_id,), 0)
    if kids or questions:
        db.execute("UPDATE book_node SET state='archived' WHERE id = ?", (node_id,))
        return {"archived": True,
                "reason": "گره دارای زیرشاخه یا تست است و به‌جای حذف آرشیو شد",
                "usage": {"children": kids, "questions": questions}}
    if hard:
        with db.write() as cur:
            cur.execute("DELETE FROM exam WHERE book_node_id = ?", (node_id,))
            cur.execute("DELETE FROM book_node WHERE id = ?", (node_id,))
        return {"deleted": True}
    db.execute("UPDATE book_node SET state='archived' WHERE id = ?", (node_id,))
    return {"archived": True}


def reorder_nodes(db: Database, book_id: int, ordered_ids: list[int]) -> dict:
    """مرتب‌سازی گره‌های یک سطح از کتاب."""
    get_book(db, book_id)
    with db.write() as cur:
        for index, node_id in enumerate(ordered_ids, start=1):
            cur.execute(
                "UPDATE book_node SET order_index = ? WHERE id = ? AND book_id = ?",
                (index, node_id, book_id),
            )
    return get_node_tree(db, book_id)


def node_path(db: Database, node_id: int | None) -> str:
    """مسیر خوانا از ریشه تا گره جاری، مانند: فصل ۱ › بخش 2-3 › تست‌های مخلوط."""
    if not node_id:
        return ""
    parts: list[str] = []
    current = db.query_one("SELECT * FROM book_node WHERE id = ?", (node_id,))
    guard = 0
    while current and guard < 20:
        parts.append(current["title"])
        current = (db.query_one("SELECT * FROM book_node WHERE id = ?",
                                (current["parent_id"],))
                   if current["parent_id"] else None)
        guard += 1
    return " › ".join(reversed(parts))


def book_overview(db: Database, book_id: int) -> dict:
    """نمای کلی کتاب: آمار ساختار و تست‌ها."""
    book = get_book(db, book_id)
    stats = db.query_one(
        """SELECT COUNT(*) AS questions,
                  SUM(CASE WHEN q.correct_answer IS NULL THEN 1 ELSE 0 END) AS without_key
             FROM question q WHERE q.book_id = ? AND q.state='active'""",
        (book_id,),
    ) or {}
    attempts = db.scalar(
        """SELECT COUNT(*) FROM question_attempt a JOIN question q ON q.id = a.question_id
            WHERE q.book_id = ?""", (book_id,), 0)
    previous = db.scalar(
        """SELECT COUNT(*) FROM previous_question_entry p JOIN question q ON q.id = p.question_id
            WHERE q.book_id = ?""", (book_id,), 0)
    type_rows = db.query(
        """SELECT node_type, COUNT(*) AS cnt FROM book_node
            WHERE book_id = ? AND state='active' GROUP BY node_type""", (book_id,))
    return {
        "book": book,
        "question_count": stats.get("questions") or 0,
        "questions_without_key": stats.get("without_key") or 0,
        "attempt_count": attempts,
        "previous_entry_count": previous,
        "node_types": {row["node_type"]: row["cnt"] for row in type_rows},
        "node_type_breakdown": dumps({row["node_type"]: row["cnt"] for row in type_rows}),
    }
