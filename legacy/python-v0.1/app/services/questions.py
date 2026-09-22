"""ماژول ۳ — بانک تست.

قاعده ۱: display_number یکتا نیست؛ شناسه یکتای واقعی question.code است (Q-000184).
قاعده ۲: محل تست در book_node_id ثبت می‌شود.
قاعده ۶: سختی ناشر با علامت‌های کاربر (مهم/سخت) یکی نیست.
"""
from __future__ import annotations

from typing import Any

from ..config import RESULTS
from ..core import (ApiError, Conflict, NotFound, as_bool, as_choice, as_id, as_int,
                    clean, like_pattern, paginate, require)
from ..db import (Database, code_exists, dumps, next_question_code, placeholders,
                  utc_now)
from .topics import ensure_topics_exist, topic_path

SORTABLE = {
    "code": "q.code",
    "display_number": "CAST(q.display_number AS INTEGER), q.display_number",
    "created_at": "q.created_at",
    "last_attempt": "last_attempt_at",
}


def _question_row(db: Database, question_id: int) -> dict:
    row = db.query_one("SELECT * FROM question WHERE id = ?", (question_id,))
    if not row:
        raise NotFound("تست یافت نشد")
    return row


# ---------------------------------------------------------------------------
# فهرست و جست‌وجو
# ---------------------------------------------------------------------------

def list_questions(db: Database, *, subject_id: int | None = None,
                   book_id: int | None = None, book_node_id: int | None = None,
                   include_subnodes: bool = True, topic_id: int | None = None,
                   include_subtopics: bool = True, result: str | None = None,
                   attempt_state: str | None = None, important: bool | None = None,
                   hard: bool | None = None, has_key: bool | None = None,
                   untried_only: bool = False, search: str | None = None,
                   state: str = "active", sort: str = "code", order: str = "asc",
                   page: int = 1, page_size: int = 50) -> dict:
    where = []
    params: list[Any] = []

    if book_node_id is not None:
        node_ids = [book_node_id]
        if include_subnodes:
            from .resources import descendants
            node_ids += [n["id"] for n in descendants(db, book_node_id)]
        where.append(f"q.book_node_id IN ({placeholders(node_ids)})")
        params.extend(node_ids)
    if book_id:
        where.append("q.book_id = ?")
        params.append(book_id)
    if subject_id:
        where.append("b.subject_id = ?")
        params.append(subject_id)
    if topic_id:
        topic_ids = [topic_id]
        if include_subtopics:
            from .topics import subtree_ids
            topic_ids = subtree_ids(db, topic_id)
        where.append(
            f"""q.id IN (SELECT question_id FROM question_topic
                          WHERE topic_id IN ({placeholders(topic_ids)}))""")
        params.extend(topic_ids)
    if state and state != "all":
        where.append("q.state = ?")
        params.append(state)
    if has_key is True:
        where.append("q.correct_answer IS NOT NULL AND q.correct_answer <> ''")
    elif has_key is False:
        where.append("(q.correct_answer IS NULL OR q.correct_answer = '')")
    if important is not None:
        where.append("""q.id IN (SELECT question_id FROM user_question_flag
                                   WHERE important = ?)""")
        params.append(1 if important else 0)
    if hard is not None:
        where.append("""q.id IN (SELECT question_id FROM user_question_flag
                                   WHERE hard = ?)""")
        params.append(1 if hard else 0)
    if search:
        like = like_pattern(search)
        where.append("""(q.code LIKE ? ESCAPE '\\' OR q.display_number LIKE ? ESCAPE '\\'
                         OR q.reference LIKE ? ESCAPE '\\'
                         OR (SELECT GROUP_CONCAT(t.title, ' ')
                               FROM question_topic qt JOIN topic t ON t.id = qt.topic_id
                              WHERE qt.question_id = q.id) LIKE ? ESCAPE '\\')""")
        params.extend([like, like, like, like])

    attempts_where = ["a.state = 'active'"]
    attempt_params: list[Any] = []
    if result == "correct":
        attempts_where.append("a.result = 'correct'")
    elif result == "incorrect":
        attempts_where.append("a.result = 'incorrect'")
    elif result == "unanswered":
        attempts_where.append("a.result = 'unanswered'")
    elif result == "solved_any":
        attempts_where.append("a.result IN ('correct','incorrect')")
    if attempt_state == "previous_only":
        where.append("EXISTS (SELECT 1 FROM previous_question_entry p "
                     "WHERE p.question_id = q.id AND p.state='active')")
        where.append("NOT EXISTS (SELECT 1 FROM question_attempt a WHERE a.question_id = q.id)")
    if untried_only:
        where.append("NOT EXISTS (SELECT 1 FROM question_attempt a "
                     "WHERE a.question_id = q.id AND a.state='active')")
        where.append("NOT EXISTS (SELECT 1 FROM previous_question_entry p "
                     "WHERE p.question_id = q.id AND p.state='active')")
    if result or result == "solved_any":
        where.append(f"""EXISTS (SELECT 1 FROM question_attempt a
                                WHERE a.question_id = q.id
                                  AND {' AND '.join(attempts_where)})""")
        params.extend(attempt_params)

    clause = " AND ".join(where) if where else "1=1"
    sort_col = SORTABLE.get(sort, SORTABLE["code"])
    direction = "DESC" if str(order).lower() == "desc" else "ASC"
    total = db.scalar(f"""SELECT COUNT(*) FROM question q
                            LEFT JOIN book b ON b.id = q.book_id
                           WHERE {clause}""", params, 0) or 0
    page = max(1, page)
    page_size = min(max(page_size, 1), 500)
    rows = db.query(
        f"""SELECT q.*, b.title AS book_title, b.publisher, s.name AS subject_name,
                   bn.title AS node_title, bn.node_type,
                   f.important, f.hard,
                   (SELECT COUNT(*) FROM question_attempt a
                     WHERE a.question_id = q.id AND a.state='active') AS attempt_count,
                   (SELECT COUNT(*) FROM previous_question_entry p
                     WHERE p.question_id = q.id AND p.state='active') AS previous_count,
                   (SELECT MAX(a.attempted_at) FROM question_attempt a
                     WHERE a.question_id = q.id AND a.state='active') AS last_attempt_at,
                   (SELECT a.result FROM question_attempt a
                     WHERE a.question_id = q.id AND a.state='active'
                     ORDER BY a.attempted_at DESC, a.id DESC LIMIT 1) AS last_result,
                   (SELECT r.state FROM review_item r
                     WHERE r.question_id = q.id AND r.state IN ('open','in_progress')
                     LIMIT 1) AS review_state,
                   (SELECT GROUP_CONCAT(t.title, ' | ')
                      FROM question_topic qt JOIN topic t ON t.id = qt.topic_id
                     WHERE qt.question_id = q.id) AS topics
              FROM question q
              LEFT JOIN book b ON b.id = q.book_id
              LEFT JOIN subject s ON s.id = b.subject_id
              LEFT JOIN book_node bn ON bn.id = q.book_node_id
              LEFT JOIN user_question_flag f ON f.question_id = q.id
             WHERE {clause}
             ORDER BY {sort_col} {direction}
             LIMIT ? OFFSET ?""",
        params + [page_size, (page - 1) * page_size],
    )
    for row in rows:
        row["is_important"] = bool(row.get("important"))
        row["is_hard"] = bool(row.get("hard"))
    return paginate(rows, page, page_size, total)


def question_summary_counts(db: Database, subject_id: int | None = None) -> dict:
    params: list[Any] = []
    clause = "q.state='active'"
    if subject_id:
        clause += " AND b.subject_id = ?"
        params.append(subject_id)
    row = db.query_one(
        f"""SELECT COUNT(*) AS total,
                   SUM(CASE WHEN EXISTS (SELECT 1 FROM question_attempt a
                                          WHERE a.question_id=q.id AND a.state='active')
                            THEN 1 ELSE 0 END) AS attempted,
                   SUM(CASE WHEN f.important = 1 THEN 1 ELSE 0 END) AS important,
                   SUM(CASE WHEN f.hard = 1 THEN 1 ELSE 0 END) AS hard,
                   SUM(CASE WHEN q.correct_answer IS NULL OR q.correct_answer=''
                            THEN 1 ELSE 0 END) AS without_key
              FROM question q
              LEFT JOIN book b ON b.id = q.book_id
              LEFT JOIN user_question_flag f ON f.question_id = q.id
             WHERE {clause}""", params) or {}
    return {k: (row.get(k) or 0) for k in
            ("total", "attempted", "important", "hard", "without_key")}


def get_question(db: Database, question_id: int,
                 include_attempts: bool = True) -> dict:
    row = db.query_one(
        """SELECT q.*, b.title AS book_title, b.publisher, b.subject_id,
                  s.name AS subject_name, bn.title AS node_title, bn.node_type,
                  f.important, f.hard
             FROM question q
             LEFT JOIN book b ON b.id = q.book_id
             LEFT JOIN subject s ON s.id = b.subject_id
             LEFT JOIN book_node bn ON bn.id = q.book_node_id
             LEFT JOIN user_question_flag f ON f.question_id = q.id
            WHERE q.id = ?""", (question_id,))
    if not row:
        raise NotFound("تست یافت نشد")
    row["is_important"] = bool(row.get("important"))
    row["is_hard"] = bool(row.get("hard"))
    row["topics"] = db.query(
        """SELECT t.id, t.title, t.status, qt.relation_type
             FROM question_topic qt JOIN topic t ON t.id = qt.topic_id
            WHERE qt.question_id = ?""", (question_id,))
    for topic in row["topics"]:
        topic["path"] = topic_path(db, topic["id"])
    if include_attempts:
        from .attempts import list_attempts, list_previous_entries
        row["attempts"] = list_attempts(db, question_id)
        row["previous_entries"] = list_previous_entries(db, question_id)
        row["performance"] = question_performance(db, question_id)
    return row


def question_performance(db: Database, question_id: int) -> dict:
    """آمار از داده خام (قاعده ۱۰): همه تلاش‌های فعال + سابقه قبلی."""
    rows = db.query(
        """SELECT result, COUNT(*) AS cnt FROM question_attempt
            WHERE question_id = ? AND state='active' GROUP BY result""", (question_id,))
    counts = {r["result"]: r["cnt"] for r in rows}
    prev = db.query(
        """SELECT result, COUNT(*) AS cnt FROM previous_question_entry
            WHERE question_id = ? AND state='active' GROUP BY result""", (question_id,))
    prev_counts = {r["result"]: r["cnt"] for r in prev}
    total = sum(counts.values())
    seconds = db.scalar(
        """SELECT SUM(spent_seconds) FROM question_attempt
            WHERE question_id = ? AND state='active'""", (question_id,), 0) or 0
    timeline = db.query(
        """SELECT 'attempt' AS kind, id, result, user_answer, spent_seconds,
                  attempted_at AS at, source, notes FROM question_attempt
            WHERE question_id = ? AND state='active'
           UNION ALL
           SELECT 'previous' AS kind, id, result, user_answer, NULL AS spent_seconds,
                  imported_at AS at, 'previous_import' AS source, note AS notes
             FROM previous_question_entry WHERE question_id = ? AND state='active'
           ORDER BY at""", (question_id, question_id))
    return {
        "attempt_count": total,
        "correct": counts.get("correct", 0),
        "incorrect": counts.get("incorrect", 0),
        "unanswered": counts.get("unanswered", 0),
        "previous_count": sum(prev_counts.values()),
        "previous_correct": prev_counts.get("correct", 0),
        "previous_incorrect": prev_counts.get("incorrect", 0),
        "previous_unanswered": prev_counts.get("unanswered", 0),
        "total_seconds": seconds,
        "never_correct": total + sum(prev_counts.values()) > 0 and (
            counts.get("correct", 0) + prev_counts.get("correct", 0)) == 0,
        "timeline": timeline,
    }


# ---------------------------------------------------------------------------
# ایجاد و ویرایش تست
# ---------------------------------------------------------------------------

def _resolve_node(db: Database, book_id: int | None, book_node_id: int | None) -> dict | None:
    if not book_node_id:
        return None
    node = db.query_one("SELECT * FROM book_node WHERE id = ?", (book_node_id,))
    if not node:
        raise NotFound("گره ساختاری کتاب یافت نشد")
    if book_id and node["book_id"] != book_id:
        raise ApiError("گره انتخاب‌شده به این کتاب تعلق ندارد", 422,
                       {"book_node_id": "گره باید از همان کتاب باشد"})
    return node


def create_question(db: Database, data: dict) -> dict:
    require(data, ["book_node_id"])
    book_node_id = as_int(data["book_node_id"], "book_node_id")
    node = _resolve_node(db, as_id(data.get("book_id"), "book_id"), book_node_id)
    book_id = as_id(data.get("book_id"), "book_id") or (node["book_id"] if node else None)
    if book_id is None:
        raise ApiError("کتاب یا محل تست باید مشخص باشد", 422, {"book_id": "الزامی"})
    return _insert_question(db, {
        "code": clean(data.get("code")),
        "book_id": book_id,
        "book_node_id": book_node_id,
        "display_number": clean(data.get("display_number")),
        "correct_answer": clean(data.get("correct_answer")),
        "publisher_difficulty": clean(data.get("publisher_difficulty")),
        "reference": clean(data.get("reference")),
        "notes": clean(data.get("notes")),
        "topic_ids": data.get("topic_ids") or [],
        "relation_type": clean(data.get("relation_type")) or "primary",
        "important": as_bool(data.get("important")),
        "hard": as_bool(data.get("hard")),
    })


def _insert_question(db: Database, payload: dict) -> dict:
    code = payload.get("code")
    if code:
        if code_exists(db, code):
            raise Conflict(f"شناسه داخلی «{code}» تکراری است؛ شناسه باید یکتا باشد")
    with db.write() as cur:
        if not code:
            code = next_question_code(db)
        cur.execute(
            """INSERT INTO question(code, book_id, book_node_id, display_number,
                                    correct_answer, publisher_difficulty, reference,
                                    notes, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (code, payload["book_id"], payload["book_node_id"], payload["display_number"],
             payload["correct_answer"], payload["publisher_difficulty"],
             payload["reference"], payload["notes"], utc_now()),
        )
        question_id = int(cur.lastrowid)
    topic_ids = [t for t in (payload.get("topic_ids") or []) if t]
    if topic_ids:
        ensure_topics_exist(db, topic_ids)
        from .topics import attach_questions
        attach_questions(db, topic_ids[0], [question_id],
                         payload.get("relation_type") or "primary")
        for extra in topic_ids[1:]:
            attach_questions(db, extra, [question_id], "secondary")
    if payload.get("important") or payload.get("hard"):
        set_flags(db, question_id, important=bool(payload.get("important")),
                  hard=bool(payload.get("hard")))
    return get_question(db, question_id, include_attempts=False)


def bulk_create_questions(db: Database, rows: list[dict], relation_type: str = "primary",
                          stop_on_error: bool = False) -> dict:
    """ورود گروهی تست‌ها با گزارش دقیق خطای هر سطر (برای ورود کتاب)."""
    created: list[dict] = []
    errors: list[dict] = []
    with db.write():
        for index, row in enumerate(rows, start=1):
            try:
                node_id = as_id(row.get("book_node_id"), "book_node_id")
                if not node_id:
                    node = _find_node_by_title(db, row)
                    if not node:
                        raise ApiError("گره ساختاری برای این سطر پیدا نشد "
                                       "(book_node_id یا مسیر گره لازم است)", 422)
                    node_id = node["id"]
                node = _resolve_node(db, as_id(row.get("book_id"), "book_id"), node_id)
                book_id = as_id(row.get("book_id"), "book_id") or node["book_id"]
                question = _insert_question(db, {
                    "code": clean(row.get("code")) or clean(row.get("internal_question_id")),
                    "book_id": book_id,
                    "book_node_id": node_id,
                    "display_number": clean(row.get("display_number")),
                    "correct_answer": clean(row.get("correct_answer")),
                    "publisher_difficulty": clean(row.get("publisher_difficulty")),
                    "reference": clean(row.get("reference")),
                    "notes": clean(row.get("notes")),
                    "topic_ids": row.get("topic_ids") or [],
                    "relation_type": relation_type,
                })
                created.append(question)
            except ApiError as exc:
                errors.append({"row": index, "error": exc.message,
                               "data": row.get("display_number") or row.get("code")})
                if stop_on_error:
                    raise
    return {"created": len(created), "skipped": len(errors), "errors": errors,
            "questions": created}


def _find_node_by_title(db: Database, row: dict) -> dict | None:
    """یافتن گره با مسیر متنی مانند «فصل ۱ / بخش 2-3» یا عنوان گره."""
    book_id = as_id(row.get("book_id"), "book_id")
    path = clean(row.get("book_node_path") or row.get("location") or row.get("node_title"))
    if not path:
        return None
    parts = [p.strip() for p in path.replace("›", "/").replace(">", "/").split("/") if p.strip()]
    parent_id = None
    current = None
    for part in parts:
        sql = "SELECT * FROM book_node WHERE title = ?"
        params: list[Any] = [part]
        if book_id:
            sql += " AND book_id = ?"
            params.append(book_id)
        if parent_id:
            sql += " AND parent_id = ?"
            params.append(parent_id)
        current = db.query_one(sql + " ORDER BY order_index LIMIT 1", params)
        if not current:
            return None
        parent_id = current["id"]
    return current


def update_question(db: Database, question_id: int, data: dict) -> dict:
    row = _question_row(db, question_id)
    updates: dict[str, Any] = {}
    for field in ("display_number", "correct_answer", "publisher_difficulty",
                  "reference", "notes"):
        if field in data:
            updates[field] = clean(data[field])
    if "book_node_id" in data:
        node_id = as_id(data["book_node_id"], "book_node_id")
        node = _resolve_node(db, as_id(data.get("book_id"), "book_id") or row["book_id"], node_id)
        updates["book_node_id"] = node_id
        if node:
            updates["book_id"] = node["book_id"]
    if "book_id" in data and "book_node_id" not in data:
        updates["book_id"] = as_id(data["book_id"], "book_id")
    if "state" in data:
        updates["state"] = as_choice(data["state"], ["active", "archived"], "state",
                                     allow_none=False)
    if "code" in data:
        code = clean(data["code"])
        if code and code != row["code"]:
            if code_exists(db, code):
                raise Conflict(f"شناسه داخلی «{code}» تکراری است")
            updates["code"] = code
    if updates:
        db.update("question", question_id, updates)
    return get_question(db, question_id)


def archive_question(db: Database, question_id: int) -> dict:
    """قاعده ۷: تست هیچ‌گاه حذف نمی‌شود، فقط آرشیو/غیرفعال می‌شود."""
    _question_row(db, question_id)
    db.execute("UPDATE question SET state='archived' WHERE id = ?", (question_id,))
    return {"archived": True, "question_id": question_id,
            "note": "سابقه حل تست حفظ شده است؛ فقط از فهرست فعال خارج شد"}


def restore_question(db: Database, question_id: int) -> dict:
    _question_row(db, question_id)
    db.execute("UPDATE question SET state='active' WHERE id = ?", (question_id,))
    return {"restored": True, "question_id": question_id}


def set_flags(db: Database, question_id: int, important: bool | None = None,
              hard: bool | None = None) -> dict:
    """علامت‌های کاربر، جدا از سختی ناشر (قاعده ۶)."""
    _question_row(db, question_id)
    current = db.query_one("SELECT * FROM user_question_flag WHERE question_id = ?",
                           (question_id,))
    new_important = int(important if important is not None
                        else bool(current and current["important"]))
    new_hard = int(hard if hard is not None else bool(current and current["hard"]))
    with db.write() as cur:
        cur.execute(
            """INSERT INTO user_question_flag(question_id, important, hard, updated_at)
               VALUES (?, ?, ?, ?)
               ON CONFLICT(question_id) DO UPDATE SET
                   important = excluded.important,
                   hard = excluded.hard,
                   updated_at = excluded.updated_at""",
            (question_id, new_important, new_hard, utc_now()))
    from .review import sync_question_review
    sync_question_review(db, question_id)
    return {"question_id": question_id, "important": bool(new_important),
            "hard": bool(new_hard)}


def set_topics(db: Database, question_id: int, links: list[dict]) -> dict:
    """جایگزینی اتصال‌های آموزشی یک تست (چندبه‌چند)."""
    _question_row(db, question_id)
    normalized: list[tuple[int, str]] = []
    for link in links:
        topic_id = as_id(link.get("topic_id"), "topic_id")
        if not topic_id:
            continue
        relation = as_choice(link.get("relation_type"), ["primary", "secondary",
                                                        "mixed", "exam", "other"],
                             "relation_type", allow_none=True, default="primary")
        normalized.append((topic_id, relation))
    if normalized:
        ensure_topics_exist(db, [t for t, _ in normalized])
    with db.write() as cur:
        cur.execute("DELETE FROM question_topic WHERE question_id = ?", (question_id,))
        for topic_id, relation in normalized:
            cur.execute(
                """INSERT OR IGNORE INTO question_topic(question_id, topic_id,
                                                        relation_type, created_at)
                   VALUES (?, ?, ?, ?)""",
                (question_id, topic_id, relation, utc_now()))
    return get_question(db, question_id, include_attempts=False)


def attempts_filters_available() -> dict:
    return {"results": RESULTS, "sorts": list(SORTABLE.keys())}


def import_questions_json(db: Database, payload: dict) -> dict:
    """ورود ساختاری از یک ساختار JSON (کتاب، ساختار، تست‌ها).

    این تابع عمداً هیچ مبحث آموزشی خودکاری نمی‌سازد: گره‌های ارزیابی مانند
    «آزمون چکاپ» و «تست‌های مخلوط» فقط گره ساختاری می‌مانند (قاعده ۵).
    """
    from .resources import create_book, create_node
    summary = {"subjects": 0, "books": 0, "nodes": 0, "questions": 0, "errors": []}
    subject_id = as_id(payload.get("subject_id"), "subject_id")
    if payload.get("subject") and not subject_id:
        from .resources import create_subject
        subject = create_subject(db, payload["subject"])
        subject_id = subject["id"]
        summary["subjects"] = 1
    book_payload = dict(payload.get("book") or {})
    if not book_payload and not payload.get("book_id"):
        raise ApiError("ساختار ورودی باید شامل book یا book_id باشد", 422)
    if payload.get("book_id"):
        book_id = as_int(payload["book_id"], "book_id")
    else:
        book_payload["subject_id"] = book_payload.get("subject_id") or subject_id
        book = create_book(db, book_payload)
        book_id = book["id"]
        summary["books"] = 1

    node_map: dict[str, int] = {}

    def walk(nodes: list[dict], parent_id: int | None):
        for node in nodes:
            created = create_node(db, {
                "book_id": book_id,
                "parent_id": parent_id,
                "node_type": node.get("node_type", "section"),
                "title": node.get("title"),
                "order_index": node.get("order_index"),
                "notes": node.get("notes"),
            })
            summary["nodes"] += 1
            if node.get("key"):
                node_map[node["key"]] = created["id"]
            walk(node.get("children") or [], created["id"])

    walk(payload.get("structure") or [], None)
    rows = []
    for question in payload.get("questions") or []:
        row = dict(question)
        if question.get("node_key") and question["node_key"] in node_map:
            row["book_node_id"] = node_map[question["node_key"]]
        row["book_id"] = book_id
        rows.append(row)
    if rows:
        result = bulk_create_questions(db, rows)
        summary["questions"] = result["created"]
        summary["errors"].extend(result["errors"])
    return {"book_id": book_id, "node_map": node_map, "summary": summary,
            "node_map_json": dumps(node_map)}
