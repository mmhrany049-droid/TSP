"""پشتیبان‌گیری، ورود/صدور داده و نمونه اولیه.

ورود گروهی تست‌ها با CSV و JSON، صدور کل پایگاه داده، بررسی یکپارچگی داده بر پایه
«قواعد اعتبارسنجی» سند ۰۳ و بارگذاری داده نمونه شیمی ۲ مبتکران.
"""
from __future__ import annotations

import csv
import io
import shutil
import sqlite3
from typing import Any

from .. import config
from ..core import ApiError, Conflict, NotFound, as_bool, as_id, clean
from ..db import Database, dumps, loads, placeholders, utc_now
from .attempts import compare_answer

EXPORT_TABLES = [
    "subject", "book", "book_node", "topic", "question", "question_topic",
    "user_question_flag", "import_batch", "question_attempt", "previous_question_entry",
    "teaching_unit", "teaching_test_goal", "exam", "exam_topic", "exam_question",
    "exam_attempt", "exam_answer", "exam_asset", "future_exam_plan",
    "future_exam_plan_topic", "review_item", "activity_log",
]

# ترتیب درج برای ورود داده (وابستگی‌های کلید خارجی)
IMPORT_ORDER = [
    "subject", "book", "book_node", "topic", "question", "question_topic",
    "user_question_flag", "import_batch", "exam", "exam_topic", "exam_question",
    "exam_attempt", "question_attempt", "previous_question_entry", "exam_answer",
    "exam_asset", "teaching_unit", "teaching_test_goal", "future_exam_plan",
    "future_exam_plan_topic", "review_item", "activity_log",
]

CSV_COLUMNS = ["book", "book_node_path", "display_number", "question_code",
               "correct_answer", "publisher_difficulty", "topic_paths", "reference",
               "notes", "important", "hard", "result", "user_answer"]


# ---------------------------------------------------------------------------
# صدور و پشتیبان
# ---------------------------------------------------------------------------

def export_all(db: Database, include_activity: bool = False) -> dict:
    payload: dict[str, Any] = {
        "meta": {
            "app_version": config.APP_VERSION,
            "schema_version": config.SCHEMA_VERSION,
            "exported_at": utc_now(),
            "format": "tsp-export-v1",
        },
        "tables": {},
    }
    for table in EXPORT_TABLES:
        if table == "activity_log" and not include_activity:
            continue
        payload["tables"][table] = db.query(f"SELECT * FROM {table}")
    payload["meta"]["counts"] = {name: len(rows)
                                 for name, rows in payload["tables"].items()}
    return payload


def backup_database(db: Database) -> dict:
    """پشتیبان فیزیکی از فایل پایگاه داده با استفاده از API پشتیبان‌گیری SQLite."""
    config.ensure_dirs()
    stamp = utc_now().replace(":", "").replace("-", "").replace("T", "-").replace("Z", "")
    target = config.BACKUP_DIR / f"tsp-{stamp}.db"
    destination = sqlite3.connect(target)
    try:
        db.conn.backup(destination)
    finally:
        destination.close()
    return {"file": str(target.relative_to(config.DATA_DIR)),
            "path": str(target), "byte_size": target.stat().st_size,
            "created_at": utc_now()}


def list_backups(db: Database) -> list[dict]:
    config.ensure_dirs()
    files = sorted(config.BACKUP_DIR.glob("*.db"), key=lambda p: p.stat().st_mtime,
                   reverse=True)
    return [{"file": path.name, "byte_size": path.stat().st_size,
             "created_at": path.stat().st_mtime} for path in files]


# ---------------------------------------------------------------------------
# ورود داده ساختاریافته (JSON)
# ---------------------------------------------------------------------------

def import_all(db: Database, payload: dict, mode: str = "merge",
               validate_only: bool = False) -> dict:
    """ورود بسته JSON که با export_all ساخته شده است.

    mode = merge  : ردیف‌های جدید با حفظ شناسه‌ها اضافه می‌شوند؛ تکراری‌ها رد می‌شوند.
    mode = replace: جداول ابتدا کامل پاک و سپس از بسته پر می‌شوند (پایگاه داده فعلی
                    پس از گرفتن پشتیبان).
    """
    tables = payload.get("tables") or payload
    if not isinstance(tables, dict) or not any(t in tables for t in IMPORT_ORDER):
        raise ApiError("ساختار بسته ورودی نامعتبر است", 422,
                       {"payload": "کلید tables با نام جداول لازم است"})
    if mode not in ("merge", "replace"):
        raise ApiError("حالت ورود نامعتبر است", 422, {"mode": "merge یا replace"})
    report: dict[str, Any] = {"mode": mode, "inserted": {}, "skipped": {},
                              "errors": [], "validated_only": validate_only}
    if validate_only:
        for table in IMPORT_ORDER:
            rows = tables.get(table) or []
            report["inserted"][table] = 0
            report["skipped"][table] = len(rows)
        report["note"] = "حالت بررسی؛ هیچ داده‌ای نوشته نشد"
        return report

    backup = backup_database(db) if mode == "replace" else None
    with db.write() as cur:
        if mode == "replace":
            for table in reversed(IMPORT_ORDER):
                cur.execute(f"DELETE FROM {table}")
        for table in IMPORT_ORDER:
            rows = tables.get(table) or []
            inserted = skipped = 0
            for row in rows:
                columns = [key for key in row.keys()
                           if not key.startswith("_") and key in _columns(db, table)]
                if not columns:
                    skipped += 1
                    continue
                placeholders_sql = ", ".join("?" for _ in columns)
                sql = (f"INSERT {'OR IGNORE' if mode == 'merge' else ''} "
                       f"INTO {table} ({', '.join(columns)}) VALUES ({placeholders_sql})")
                try:
                    cur.execute(sql, tuple(row.get(col) for col in columns))
                    if cur.rowcount:
                        inserted += 1
                    else:
                        skipped += 1
                except sqlite3.Error as exc:
                    skipped += 1
                    if len(report["errors"]) < 50:
                        report["errors"].append({"table": table, "error": str(exc),
                                                 "row_id": row.get("id")})
            report["inserted"][table] = inserted
            report["skipped"][table] = skipped
    report["backup"] = backup
    return report


def _columns(db: Database, table: str) -> set[str]:
    return {row["name"] for row in db.query(f"PRAGMA table_info({table})")}


# ---------------------------------------------------------------------------
# ورود گروهی تست با CSV
# ---------------------------------------------------------------------------

def csv_template() -> str:
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(CSV_COLUMNS)
    writer.writerow(["شیمی ۲ مبتکران", "فصل ۱ / 2. الگوها و روندها / 2-1 ...", "17", "",
                     "3", "متوسط", "الگوها و روندها در رفتار مواد", "", "", "خیر", "بله",
                     "", ""])
    writer.writerow(["شیمی ۲ مبتکران", "فصل ۱ / آزمون چکاپ اول", "4", "", "1", "",
                     "رفتار عنصرها و شعاع اتمی", "", "از آزمون چکاپ", "بله", "خیر",
                     "incorrect", "2"])
    return buffer.getvalue()


class _RollbackRequested(Exception):
    """برای حالت آزمایش (dry_run): تراکنش در پایان بازگردانی می‌شود."""


def import_questions_csv(db: Database, text: str, book_id: int | None = None,
                         dry_run: bool = False) -> dict:
    """ورود گروهی تست‌ها از CSV؛ سطرهای دارای result به «سابقه قبلی» هم می‌روند."""
    from .attempts import record_previous_entries
    from .questions import create_question
    from .resources import create_node
    from .topics import create_topic

    reader = csv.DictReader(io.StringIO(text.lstrip("\ufeff")))
    if not reader.fieldnames:
        raise ApiError("فایل CSV خالی است یا سرسطر ندارد", 422, {"file": "نامعتبر"})
    created_questions: list[dict] = []
    history_rows: list[dict] = []
    errors: list[dict] = []
    nodes_created = 0
    pending_history: list[dict] = []

    # ورود سابقه قبلی پس از تراکنش اصلی انجام می‌شود تا شناسه تست‌ها تثبیت شده باشد
    def _write() -> None:
        nonlocal nodes_created
        for index, raw in enumerate(reader, start=2):
            row = {(k or "").strip(): (v or "").strip() for k, v in raw.items()}
            try:
                target_book = _resolve_book(db, row.get("book"), book_id)
                node = _resolve_or_create_node(db, target_book, row.get("book_node_path"),
                                               create_node)
                nodes_created += node["created_count"]
                topic_ids = _resolve_topics(db, row.get("topic_paths"), target_book,
                                            create_topic)
                question = create_question(db, {
                    "book_id": target_book,
                    "book_node_id": node["id"],
                    "display_number": row.get("display_number"),
                    "code": row.get("question_code") or None,
                    "correct_answer": row.get("correct_answer"),
                    "publisher_difficulty": row.get("publisher_difficulty"),
                    "reference": row.get("reference"),
                    "notes": row.get("notes"),
                    "topic_ids": topic_ids,
                    "important": as_bool(row.get("important")),
                    "hard": as_bool(row.get("hard")),
                })
                created_questions.append(question)
                if row.get("result") or row.get("user_answer"):
                    pending_history.append({
                        "question_id": question["id"],
                        "user_answer": row.get("user_answer"),
                        "result": row.get("result") or None,
                    })
            except ApiError as exc:
                errors.append({"line": index, "error": exc.message})

    try:
        with db.write():
            _write()
            if dry_run:
                raise _RollbackRequested()
    except _RollbackRequested:
        pass
    if pending_history and not dry_run:
        previous = record_previous_entries(db, pending_history,
                                           import_label="ورود CSV تست‌ها",
                                           auto_review=True)
    else:
        previous = None
    return {
        "created": len(created_questions),
        "nodes_created": nodes_created,
        "errors": errors,
        "questions": [{"id": q["id"], "code": q["code"]} for q in created_questions],
        "previous_entries": previous,
        "dry_run": dry_run,
    }


def _resolve_book(db: Database, book_title: str | None, fallback_id: int | None) -> int:
    if book_title:
        row = db.query_one("SELECT id FROM book WHERE title = ? LIMIT 1", (book_title,))
        if row:
            return row["id"]
        raise ApiError(f"کتاب «{book_title}» یافت نشد", 422, {"book": "نامشخص"})
    if fallback_id:
        if not db.scalar("SELECT 1 FROM book WHERE id = ?", (fallback_id,)):
            raise NotFound("کتاب انتخاب‌شده یافت نشد")
        return fallback_id
    raise ApiError("برای هر سطر نام کتاب یا شناسه کتاب لازم است", 422, {"book": "خالی"})


def _resolve_or_create_node(db: Database, book_id: int, path: str | None,
                            create_node) -> dict:
    if not path:
        raise ApiError("مسیر گره ساختاری (book_node_path) الزامی است", 422,
                       {"book_node_path": "خالی"})
    parts = [p.strip() for p in path.replace("›", "/").replace(">", "/").split("/")
             if p.strip()]
    parent_id = None
    current = None
    created_count = 0
    for part in parts:
        sql = "SELECT * FROM book_node WHERE book_id = ? AND title = ?"
        params: list[Any] = [book_id, part]
        if parent_id:
            sql += " AND parent_id = ?"
            params.append(parent_id)
        current = db.query_one(sql + " ORDER BY order_index LIMIT 1", params)
        if not current:
            current = create_node(db, {
                "book_id": book_id, "parent_id": parent_id,
                "node_type": _guess_node_type(part), "title": part,
            })
            created_count += 1
        parent_id = current["id"]
    return {"id": current["id"], "created": created_count > 0,
            "created_count": created_count}


def _guess_node_type(title: str) -> str:
    text = title.strip()
    if text.startswith("فصل"):
        return "chapter"
    if "تست‌های مخلوط" in text or "تست های مخلوط" in text:
        return "mixed_tests"
    if "چکاپ" in text:
        return "checkup_exam"
    if "جامع" in text:
        return "comprehensive_exam"
    if "کنکور" in text:
        return "entrance_exam"
    if text[:2].strip() and text[0].isdigit() and "." in text[:3]:
        return "lesson"
    return "section"


def _resolve_topics(db: Database, paths: str | None, book_id: int, create_topic) -> list[int]:
    if not paths:
        return []
    subject_id = db.scalar("SELECT subject_id FROM book WHERE id = ?", (book_id,))
    topic_ids: list[int] = []
    for raw_path in paths.replace("؛", ";").replace("|", ";").split(";"):
        parts = [p.strip() for p in raw_path.replace("›", "/").split("/") if p.strip()]
        parent_id = None
        for part in parts:
            sql = "SELECT * FROM topic WHERE title = ?"
            params: list[Any] = [part]
            if parent_id:
                sql += " AND parent_id = ?"
                params.append(parent_id)
            elif subject_id:
                sql += " AND IFNULL(subject_id,0) = ?"
                params.append(subject_id)
            row = db.query_one(sql + " ORDER BY order_index LIMIT 1", params)
            if not row:
                row = create_topic(db, {"title": part, "parent_id": parent_id,
                                        "subject_id": subject_id})
            parent_id = row["id"]
        if parent_id:
            topic_ids.append(parent_id)
    return topic_ids


# ---------------------------------------------------------------------------
# بررسی یکپارچگی داده (قواعد اعتبارسنجی سند ۰۳)
# ---------------------------------------------------------------------------

def validate_all(db: Database) -> dict:
    checks: list[dict] = []

    def add(check_id: str, title: str, rows: list[dict], rule: str):
        checks.append({"id": check_id, "title": title, "rule": rule,
                       "count": len(rows), "items": rows[:30],
                       "status": "ok" if not rows else "warning"})

    add("duplicate_display_number", "شماره نمایشی تکراری در یک محل",
        db.query("""SELECT book_node_id, display_number, COUNT(*) AS cnt,
                           GROUP_CONCAT(code) AS codes FROM question
                     WHERE display_number IS NOT NULL AND state='active'
                     GROUP BY book_node_id, display_number HAVING COUNT(*) > 1"""),
        "شماره تست یکتا نیست و تکرار آن در یک محل می‌تواند نشانه ورود اشتباه باشد")

    add("question_without_node", "تست بدون محل در ساختار کتاب",
        db.query("""SELECT id, code FROM question
                     WHERE book_node_id IS NULL AND state='active'"""),
        "قاعده ۲: محل تست باید در BookNode ثبت شود")

    add("question_without_key", "تست بدون پاسخ صحیح",
        db.query("""SELECT id, code FROM question
                     WHERE (correct_answer IS NULL OR correct_answer='') AND state='active'"""),
        "برای مقایسه خودکار پاسخ، کلید تست لازم است")

    add("assessment_as_topic", "گره ارزیابی که به‌عنوان مبحث استفاده شده",
        db.query("""SELECT DISTINCT t.id, t.title FROM topic t
                     JOIN question_topic qt ON qt.topic_id = t.id
                     JOIN question q ON q.id = qt.question_id
                     JOIN book_node bn ON bn.id = q.book_node_id
                    WHERE bn.node_type IN ('checkup_exam','comprehensive_exam',
                                           'entrance_exam','mixed_tests')
                      AND t.title = bn.title"""),
        "قاعده ۵: آزمون چکاپ/جامع و تست‌های مخلوط مبحث آموزشی نیستند")

    add("attempt_without_question", "تلاش با تست ناموجود",
        db.query("""SELECT a.id FROM question_attempt a
                     LEFT JOIN question q ON q.id = a.question_id
                    WHERE q.id IS NULL"""),
        "قاعده ۷: هر تلاش باید به یک تست معتبر متصل باشد")

    add("previous_without_question", "سابقه قبلی با تست ناموجود",
        db.query("""SELECT p.id FROM previous_question_entry p
                     LEFT JOIN question q ON q.id = p.question_id
                    WHERE q.id IS NULL"""),
        "قاعده ۸: سابقه قبلی باید به تست معتبر متصل باشد")

    add("duplicate_question_codes", "شناسه داخلی تکراری",
        db.query("""SELECT code, COUNT(*) AS cnt FROM question
                     GROUP BY code HAVING COUNT(*) > 1"""),
        "قاعده ۱: internal_question_id باید یکتا باشد")

    add("exam_answer_without_question", "پاسخ آزمون بدون تعریف سؤال",
        db.query("""SELECT aa.id FROM exam_answer aa
                     LEFT JOIN exam_question eq ON eq.id = aa.exam_question_id
                    WHERE eq.id IS NULL"""),
        "قاعده ۹: پاسخ‌ها متعلق به سؤال‌های همان آزمون هستند")

    add("future_attempt", "تلاش با تاریخ آینده",
        db.query("SELECT id, attempted_at FROM question_attempt "
                 "WHERE attempted_at > datetime('now', '+1 day')"),
        "تاریخ ثبت‌شده باید معتبر باشد")

    add("goal_without_questions", "هدف مبحث بدون تست در بانک",
        db.query("""SELECT g.id, t.title FROM teaching_test_goal g
                     JOIN topic t ON t.id = g.topic_id
                    WHERE g.status='active'
                      AND NOT EXISTS (SELECT 1 FROM question_topic qt
                                       WHERE qt.topic_id = g.topic_id)"""),
        "هدفی که تستی برای آن تعریف نشده قابل اندازه‌گیری نیست")

    add("orphan_review_items", "مورد مرور بدون تست یا مبحث",
        db.query("""SELECT r.id FROM review_item r
                     LEFT JOIN question q ON q.id = r.question_id
                     LEFT JOIN topic t ON t.id = r.topic_id
                    WHERE r.question_id IS NOT NULL AND q.id IS NULL
                       OR r.topic_id IS NOT NULL AND r.question_id IS NULL AND t.id IS NULL"""),
        "هر مورد مرور باید به تست یا مبحث معتبر متصل باشد")

    summary = {
        "checked_at": utc_now(),
        "total_checks": len(checks),
        "passed": sum(1 for c in checks if c["status"] == "ok"),
        "warnings": sum(1 for c in checks if c["status"] != "ok"),
        "checks": checks,
    }
    return summary


# ---------------------------------------------------------------------------
# داده نمونه: شیمی ۲ مبتکران (فصل ۱ و بخشی از فصل ۲)
# ---------------------------------------------------------------------------

def sample_available(db: Database) -> bool:
    return not db.scalar("SELECT 1 FROM question LIMIT 1", (), None)


def load_sample(db: Database) -> dict:
    """بارگذاری نمونه شیمی ۲ مبتکران؛ فقط روی پایگاه داده خالی انجام می‌شود."""
    if not sample_available(db):
        raise Conflict("پایگاه داده خالی نیست؛ برای جلوگیری از اختلاط داده واقعی، "
                       "بارگذاری نمونه فقط روی پایگاه داده خالی ممکن است")
    from .attempts import record_attempt, record_previous_entries
    from .resources import create_book, create_node, create_subject
    from .topics import attach_questions, create_topic

    subject = create_subject(db, {"name": "شیمی", "grade": "یازدهم",
                                  "field_of_study": "ریاضی‌فیزیک", "color": "#0ea5e9",
                                  "notes": "نمونه داده اولیه"})
    book = create_book(db, {"subject_id": subject["id"], "title": "شیمی ۲ مبتکران",
                            "publisher": "مبتکران", "grade": "یازدهم",
                            "edition_year": "1403/1404",
                            "notes": "نمونه ساختار بر پایه سند ۰۳"})

    def node(**kwargs):
        return create_node(db, {"book_id": book["id"], **kwargs})

    chapter1 = node(node_type="chapter", title="فصل ۱", order_index=1)
    lesson1 = node(parent_id=chapter1["id"], node_type="lesson",
                   title="1. موضوع انشاء: هدایای زمینی!", order_index=1)
    sub11 = node(parent_id=lesson1["id"], node_type="subsection",
                 title="1-1 سهم عنصرها در پوسته زمین", order_index=1)
    lesson2 = node(parent_id=chapter1["id"], node_type="lesson",
                   title="2. الگوها و روندها در رفتار مواد", order_index=2)
    sub21 = node(parent_id=lesson2["id"], node_type="subsection",
                 title="2-1 جدول تناوبی و آرایش الکترونی", order_index=1)
    sub22 = node(parent_id=lesson2["id"], node_type="subsection",
                 title="2-2 روند خواص در جدول تناوبی", order_index=2)
    mixed1 = node(parent_id=lesson2["id"], node_type="mixed_tests",
                  title="تست‌های مخلوط", order_index=3)
    lesson3 = node(parent_id=chapter1["id"], node_type="lesson",
                   title="3. رفتار عنصرها و شعاع اتمی", order_index=3)
    checkup1 = node(parent_id=chapter1["id"], node_type="checkup_exam",
                    title="آزمون چکاپ اول", order_index=4)
    comprehensive1 = node(parent_id=chapter1["id"], node_type="comprehensive_exam",
                          title="آزمون جامع اول", order_index=5)

    chapter2 = node(node_type="chapter", title="فصل ۲", order_index=2)
    lesson21 = node(parent_id=chapter2["id"], node_type="lesson",
                    title="1. قدر هدایای زمینی را بدانیم", order_index=1)
    mixed2 = node(parent_id=lesson21["id"], node_type="mixed_tests",
                  title="تست‌های مخلوط", order_index=2)

    topics = {}
    topics["earth"] = create_topic(db, {"subject_id": subject["id"],
                                        "title": "هدایای زمینی و سهم عنصرها",
                                        "order_index": 1})
    parent = create_topic(db, {"subject_id": subject["id"],
                               "title": "الگوها و روندها در رفتار مواد",
                               "order_index": 2})
    topics["table"] = create_topic(db, {"subject_id": subject["id"], "parent_id": parent["id"],
                                        "title": "جدول تناوبی و آرایش الکترونی",
                                        "order_index": 1})
    topics["trends"] = create_topic(db, {"subject_id": subject["id"], "parent_id": parent["id"],
                                         "title": "روند خواص در جدول تناوبی",
                                         "order_index": 2})
    topics["radius"] = create_topic(db, {"subject_id": subject["id"],
                                         "title": "رفتار عنصرها و شعاع اتمی",
                                         "order_index": 3})
    topics["period"] = create_topic(db, {"subject_id": subject["id"],
                                         "title": "جدول تناوبی و دوره‌ها",
                                         "order_index": 4})

    question_specs = [
        # (گره، شماره نمایشی، پاسخ، سختی ناشر، مبحث‌ها)
        (sub11, ["1", "2", "3", "4"], "2", "آسان", ["earth"]),
        (sub21, ["1", "2", "3", "4", "5"], "3", "متوسط", ["table"]),
        (sub22, ["1", "2", "3", "4"], "1", "سخت", ["trends"]),
        (mixed1, ["1", "2", "3", "4", "5", "6"], "4", None, ["table", "trends"]),
        (lesson3, ["1", "2", "3"], "2", "متوسط", ["radius"]),
        (checkup1, ["1", "2", "3", "4"], "1", None, ["radius", "trends"]),
        (comprehensive1, ["1", "2", "3", "4", "5"], "3", None, ["table", "earth"]),
        (mixed2, ["1", "2", "3", "4"], "2", "آسان", ["period"]),
    ]
    created: list[dict] = []
    for node_row, numbers, answer, difficulty, topic_keys in question_specs:
        for index, display_number in enumerate(numbers, start=1):
            from .questions import create_question
            question = create_question(db, {
                "book_id": book["id"],
                "book_node_id": node_row["id"],
                "display_number": display_number,
                "correct_answer": str(((int(answer) + index - 1) % 4) + 1),
                "publisher_difficulty": difficulty,
                "reference": f"صفحه نمونه {index}",
                "important": index == 1,
                "hard": difficulty == "سخت",
                "topic_ids": [topics[key]["id"] for key in topic_keys],
            })
            created.append(question)
    # سابقه قبلی: بخشی از تست‌ها پیش از استفاده از نرم‌افزار حل شده‌اند
    history = [{"question_id": created[0]["id"], "user_answer": "2", "result": "incorrect",
                "note": "پیش از راه‌اندازی سیستم"},
               {"question_id": created[1]["id"], "user_answer": None, "result": "unanswered"},
               {"question_id": created[5]["id"], "user_answer": "3", "result": "correct"},
               {"question_id": created[9]["id"], "user_answer": "1", "result": "incorrect"},
               {"question_id": created[13]["id"], "user_answer": None, "result": "unanswered"},
               {"question_id": created[17]["id"], "user_answer": "4", "result": "correct"}]
    previous = record_previous_entries(db, history, import_label="نمونه شیمی ۲ مبتکران")
    # چند تلاش جدید امروز
    attempts = [
        {"question_id": created[2]["id"], "user_answer": "2", "spent_seconds": 45,
         "result": "incorrect"},
        {"question_id": created[2]["id"], "user_answer": "3", "spent_seconds": 30,
         "result": "correct", "notes": "مرور همان تست"},
        {"question_id": created[6]["id"], "user_answer": "3", "spent_seconds": 70},
        {"question_id": created[10]["id"], "user_answer": None, "spent_seconds": 20,
         "result": "unanswered"},
        {"question_id": created[14]["id"], "user_answer": "2", "spent_seconds": 55},
    ]
    new_attempts = []
    for row in attempts:
        new_attempts.append(record_attempt(db, row, source="app"))
    # هدف و وضعیت تدریس نمونه
    from .teaching import create_goal, set_teaching_status
    set_teaching_status(db, topics["table"]["id"], {"taught_status": "taught"})
    set_teaching_status(db, topics["trends"]["id"], {"taught_status": "in_progress"})
    set_teaching_status(db, topics["earth"]["id"], {"taught_status": "taught"})
    create_goal(db, {"topic_id": topics["table"]["id"], "target_count": 10,
                     "period_label": "مهر ۱۴۰۴"})
    create_goal(db, {"topic_id": topics["radius"]["id"], "target_count": 8,
                     "period_label": "مهر ۱۴۰۴"})
    from .review import sync_all
    sync_all(db)
    return {
        "subject_id": subject["id"], "book_id": book["id"],
        "nodes": db.scalar("SELECT COUNT(*) FROM book_node WHERE book_id = ?", (book["id"],), 0),
        "topics": db.scalar("SELECT COUNT(*) FROM topic WHERE subject_id = ?",
                            (subject["id"],), 0),
        "questions": len(created),
        "previous_entries": previous["created"], "attempts": len(new_attempts),
        "note": "داده نمونه بارگذاری شد؛ آمار از همین داده‌های خام محاسبه می‌شود",
    }
