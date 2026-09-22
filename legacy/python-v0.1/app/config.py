"""تنظیمات و ثابت‌های برنامه TSP نسخه ۰.۱"""
from __future__ import annotations

import os
from pathlib import Path

APP_VERSION = "0.1.0"
SCHEMA_VERSION = 1

BASE_DIR = Path(__file__).resolve().parent.parent
STATIC_DIR = Path(__file__).resolve().parent / "static"
SCHEMA_FILE = Path(__file__).resolve().parent / "schema.sql"

DATA_DIR = Path(os.environ.get("TSP_DATA_DIR", BASE_DIR / "data"))
DB_PATH = Path(os.environ.get("TSP_DB", DATA_DIR / "tsp.db"))
UPLOAD_DIR = DATA_DIR / "assets"
BACKUP_DIR = DATA_DIR / "backups"

MAX_JSON_BODY = 64 * 1024 * 1024          # ۶۴ مگابایت برای بارهای JSON
MAX_UPLOAD_BODY = 128 * 1024 * 1024       # ۱۲۸ مگابایت برای بارگذاری فایل

# ---------------------------------------------------------------------------
# واژگان برنامه (به رابط کاربری هم داده می‌شود تا برچسب‌های فارسی یکسان بمانند)
# ---------------------------------------------------------------------------

NODE_TYPES = [
    "chapter", "lesson", "section", "subsection",
    "test_set", "mixed_tests", "checkup_exam", "comprehensive_exam",
    "entrance_exam", "other_assessment",
]

ASSESSMENT_NODE_TYPES = [
    "test_set", "mixed_tests", "checkup_exam",
    "comprehensive_exam", "entrance_exam", "other_assessment",
]

RESULTS = ["correct", "incorrect", "unanswered"]

ATTEMPT_SOURCES = ["app", "review", "exam", "other"]

TAUGHT_STATUSES = ["not_started", "in_progress", "taught", "needs_review"]

TOPIC_STATUSES = ["planned", "active", "in_progress", "mastered", "archived"]

TOPIC_RELATION_TYPES = ["primary", "secondary", "mixed", "exam", "other"]

EXAM_TYPES = ["single_subject", "mock_multi_subject", "book_assessment", "other"]

EXAM_STATES = ["planned", "ready", "held", "analyzed", "archived"]

REVIEW_REASONS = [
    "incorrect", "unanswered", "incorrect_previous", "unanswered_previous",
    "important", "hard", "goal_remaining", "upcoming_exam", "manual",
]

REVIEW_STATES = ["open", "in_progress", "resolved", "archived"]

ANALYTICS_LEVELS = [
    "overall", "subject", "book", "book_node", "topic",
    "question", "exam", "day", "week", "month",
]

LABELS_FA = {
    "result": {"correct": "درست", "incorrect": "غلط", "unanswered": "بی‌پاسخ"},
    "node_type": {
        "chapter": "فصل", "lesson": "درس", "section": "بخش",
        "subsection": "زیرعنوان", "test_set": "مجموعه تست",
        "mixed_tests": "تست‌های مخلوط", "checkup_exam": "آزمون چکاپ",
        "comprehensive_exam": "آزمون جامع", "entrance_exam": "آزمون کنکور",
        "other_assessment": "مجموعه ارزیابی دیگر",
    },
    "taught_status": {
        "not_started": "تدریس نشده", "in_progress": "در حال تدریس",
        "taught": "تدریس شده", "needs_review": "نیاز به مرور",
    },
    "review_reason": {
        "incorrect": "غلط در آخرین تلاش",
        "unanswered": "بی‌پاسخ در آخرین تلاش",
        "incorrect_previous": "غلط در سابقه قبلی",
        "unanswered_previous": "بی‌پاسخ در سابقه قبلی",
        "important": "علامت مهم",
        "hard": "علامت سخت",
        "goal_remaining": "باقی‌مانده از هدف",
        "upcoming_exam": "مرتبط با آزمون آینده",
        "manual": "افزودن دستی",
    },
    "review_state": {
        "open": "باز", "in_progress": "در حال بررسی",
        "resolved": "حل‌شده", "archived": "آرشیو",
    },
    "topic_status": {
        "planned": "برنامه‌ریزی‌شده", "active": "فعال", "in_progress": "در حال کار",
        "mastered": "مسلط", "archived": "آرشیو",
    },
    "relation_type": {
        "primary": "مبحث اصلی", "secondary": "مبحث فرعی", "mixed": "تست مخلوط",
        "exam": "آزمونی", "other": "سایر",
    },
    "exam_type": {
        "single_subject": "آزمون تک‌درس",
        "mock_multi_subject": "آزمون آزمایشی چنددرس",
        "book_assessment": "آزمون داخل کتاب",
        "other": "سایر",
    },
    "exam_state": {
        "planned": "برنامه‌ریزی‌شده", "ready": "آماده", "held": "برگزارشده",
        "analyzed": "تحلیل‌شده", "archived": "آرشیو",
    },
    "preparation_status": {
        "planning": "برنامه‌ریزی", "studying": "در حال مطالعه",
        "reviewing": "در حال مرور", "ready": "آماده", "done": "پایان‌یافته",
    },
}


def ensure_dirs() -> None:
    for path in (DATA_DIR, UPLOAD_DIR, BACKUP_DIR):
        path.mkdir(parents=True, exist_ok=True)
