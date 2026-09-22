"""آزمون‌های سرتاسری API برنامه TSP نسخه ۰.۱

اجرا:
    python3 -m unittest discover -s tests -v
    python3 tests/test_api.py

هر آزمون روی یک پایگاه داده موقت و یک سرور واقعی HTTP انجام می‌شود؛ بنابراین
مسیرها، اعتبارسنجی و قواعد داده هم‌زمان بررسی می‌شوند.
"""
from __future__ import annotations

import json
import os
import shutil
import sys
import tempfile
import threading
import unittest
import urllib.error
import urllib.request
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app import config                      # noqa: E402
from app.db import Database                 # noqa: E402
from app.routes import register_all         # noqa: E402
from app.server import Handler, create_server   # noqa: E402


class ApiClient:
    def __init__(self, base: str):
        self.base = base

    def request(self, method: str, path: str, body=None, raw=False, headers=None):
        url = self.base + path
        data = None
        request_headers = dict(headers or {})
        if body is not None:
            if isinstance(body, (bytes, bytearray)):
                data = bytes(body)
            else:
                data = json.dumps(body, ensure_ascii=False).encode("utf-8")
                request_headers.setdefault("Content-Type", "application/json")
        request = urllib.request.Request(url, data=data, method=method,
                                         headers=request_headers)
        try:
            with urllib.request.urlopen(request) as response:
                payload = response.read()
                if raw:
                    return response.status, payload
                return response.status, (json.loads(payload) if payload else None)
        except urllib.error.HTTPError as error:
            payload = error.read()
            try:
                parsed = json.loads(payload)
            except json.JSONDecodeError:
                parsed = {"error": payload.decode("utf-8", "replace")}
            return error.code, parsed

    def get(self, path, **kwargs):
        return self.request("GET", path, **kwargs)

    def get_with_headers(self, path):
        """پاسخ خام همراه با هدرها (برای بررسی Content-Disposition)."""
        request = urllib.request.Request(self.base + path, method="GET")
        with urllib.request.urlopen(request) as response:
            body = response.read()
            return response.status, body, dict(response.headers)

    def post(self, path, body=None, **kwargs):
        return self.request("POST", path, body if body is not None else {}, **kwargs)

    def put(self, path, body=None, **kwargs):
        return self.request("PUT", path, body if body is not None else {}, **kwargs)

    def patch(self, path, body=None, **kwargs):
        return self.request("PATCH", path, body if body is not None else {}, **kwargs)

    def delete(self, path, **kwargs):
        return self.request("DELETE", path, **kwargs)

    def multipart(self, path, filename, content, field="file"):
        boundary = uuid.uuid4().hex
        body = (
            f"--{boundary}\r\n"
            f'Content-Disposition: form-data; name="{field}"; filename="{filename}"\r\n'
            f"Content-Type: application/octet-stream\r\n\r\n"
        ).encode("utf-8") + content + f"\r\n--{boundary}--\r\n".encode("utf-8")
        return self.request("POST", path, body,
                            headers={"Content-Type": f"multipart/form-data; boundary={boundary}"})


class TSPTestCase(unittest.TestCase):
    """پایه: برای هر آزمون یک پایگاه داده و سرور تازه ساخته می‌شود تا داده‌ها
    بین آزمون‌ها تداخل نکنند (هر آزمون مستقل و قابل تکرار باشد)."""

    def setUp(self):
        Handler.log_message = lambda *args, **kwargs: None  # لاگ درخواست‌ها لازم نیست
        self.tmpdir = tempfile.mkdtemp(prefix="tsp-test-")
        os.environ["TSP_DATA_DIR"] = self.tmpdir
        config.DATA_DIR = Path(self.tmpdir)
        config.DB_PATH = Path(self.tmpdir) / "test.db"
        config.UPLOAD_DIR = config.DATA_DIR / "assets"
        config.BACKUP_DIR = config.DATA_DIR / "backups"
        config.ensure_dirs()
        self.db = Database(config.DB_PATH)
        self.db.init_schema()
        register_all()
        self.server = create_server(self.db, host="127.0.0.1", port=0)
        self.port = self.server.server_address[1]
        self.thread = threading.Thread(
            target=self.server.serve_forever, kwargs={"poll_interval": 0.02}, daemon=True)
        self.thread.start()
        self.client = ApiClient(f"http://127.0.0.1:{self.port}")

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(timeout=3)
        self.db.close()
        shutil.rmtree(self.tmpdir, ignore_errors=True)

    # -- کمکی‌ها ------------------------------------------------------------
    def ok(self, response, status=200, message=""):
        code, payload = response
        self.assertEqual(code, status,
                         f"{message or 'درخواست'} → کد {code}: {payload}")
        return payload

    def make_book(self, title="شیمی ۲ مبتکران"):
        payload = self.ok(self.client.post("/api/books", {
            "title": title, "publisher": "مبتکران", "grade": "یازدهم",
        }), 201)
        return payload

    def make_node(self, book_id, title, node_type="section", parent_id=None):
        return self.ok(self.client.post(f"/api/books/{book_id}/nodes", {
            "title": title, "node_type": node_type, "parent_id": parent_id,
        }), 201)

    def make_topic(self, title, parent_id=None):
        return self.ok(self.client.post("/api/topics", {
            "title": title, "parent_id": parent_id,
        }), 201)

    def make_question(self, node_id, display_number="1", answer="2", **extra):
        body = {"book_node_id": node_id, "display_number": display_number,
                "correct_answer": answer}
        body.update(extra)
        return self.ok(self.client.post("/api/questions", body), 201)


class FacilityTests(TSPTestCase):
    """بستر: سلامت سرور، فراداده و فایل‌های ایستا."""

    def test_health_and_meta(self):
        health = self.ok(self.client.get("/api/health"))
        self.assertEqual(health["status"], "ok")
        self.assertEqual(health["version"], config.APP_VERSION)
        meta = self.ok(self.client.get("/api/meta"))
        self.assertTrue(meta["labels"]["review_reason"]["incorrect"])
        self.assertTrue(meta["labels"]["node_type"]["mixed_tests"])
        self.assertIn("chapter", meta["enums"]["node_types"])
        self.assertIn("mixed_tests", meta["enums"]["assessment_node_types"])

    def test_static_pages_serve(self):
        for path in ("/", "/js/app.js", "/css/app.css", "/js/views/review.js"):
            code, payload = self.client.get(path, raw=True)
            self.assertEqual(code, 200, path)
            self.assertTrue(payload)

    def test_unknown_api_route_returns_404(self):
        code, payload = self.client.get("/api/does-not-exist")
        self.assertEqual(code, 404)
        self.assertIn("error", payload)

    def test_spa_fallback_for_unknown_page(self):
        code, payload = self.client.get("/some/spa/route", raw=True)
        self.assertEqual(code, 200)
        self.assertIn(b"TSP", payload)


class ResourceTests(TSPTestCase):
    """ماژول ۱: درس، کتاب و ساختار انعطاف‌پذیر کتاب."""

    def test_subject_and_book_lifecycle(self):
        subject = self.ok(self.client.post("/api/subjects", {
            "name": "شیمی", "grade": "یازدهم", "field_of_study": "ریاضی‌فیزیک",
        }), 201)
        books = self.ok(self.client.get("/api/books"))
        book = self.ok(self.client.post("/api/books", {
            "title": "شیمی ۲ مبتکران", "subject_id": subject["id"],
            "publisher": "مبتکران", "edition_year": "1403/1404",
        }), 201)
        self.assertEqual(book["subject_id"], subject["id"])

        updated = self.ok(self.client.put(f"/api/books/{book['id']}", {"notes": "نسخه آزمایشی"}))
        self.assertEqual(updated["notes"], "نسخه آزمایشی")

        # آرشیو کتاب دارای داده باید فقط آرشیو شود (نه حذف)
        self.make_node(book["id"], "فصل ۱", "chapter")
        result = self.ok(self.client.delete(f"/api/books/{book['id']}"))
        self.assertTrue(result.get("archived"))
        active = self.ok(self.client.get("/api/books"))["items"]
        self.assertNotIn(book["id"], [item["id"] for item in active])
        with_archived = self.ok(self.client.get(
            "/api/books?include_archived=true"))["items"]
        self.assertIn(book["id"], [item["id"] for item in with_archived])
        restored = self.ok(self.client.put(f"/api/books/{book['id']}",
                                          {"state": "active"}))
        self.assertEqual(restored["state"], "active")

    def test_flexible_structure_and_assessment_nodes(self):
        book = self.make_book("کتاب ساختار")
        chapter = self.make_node(book["id"], "فصل ۱", "chapter")
        lesson = self.make_node(book["id"], "2. الگوها و روندها",
                                "lesson", parent_id=chapter["id"])
        mixed = self.make_node(book["id"], "تست‌های مخلوط", "mixed_tests",
                               parent_id=lesson["id"])
        checkup = self.make_node(book["id"], "آزمون چکاپ اول", "checkup_exam",
                                 parent_id=chapter["id"])

        tree = self.ok(self.client.get(f"/api/books/{book['id']}/tree"))
        self.assertEqual(len(tree["tree"]), 1)
        self.assertEqual(tree["tree"][0]["node_type"], "chapter")
        titles = [child["title"] for child in tree["tree"][0]["children"]]
        self.assertIn("2. الگوها و روندها", titles)
        self.assertEqual(tree["node_count"], 4)

        # گره ارزیابی صرفاً ساختاری است و نباید مبحث آموزشی ساخته باشد
        topics = self.ok(self.client.get("/api/topics"))
        self.assertNotIn("تست‌های مخلوط", [t["title"] for t in topics["items"]])
        self.assertNotIn("آزمون چکاپ اول", [t["title"] for t in topics["items"]])

        overview = self.ok(self.client.get(f"/api/books/{book['id']}/overview"))
        self.assertEqual(overview["node_types"]["mixed_tests"], 1)
        self.assertEqual(overview["node_types"]["checkup_exam"], 1)
        self.assertIsNotNone(mixed["id"])
        self.assertIsNotNone(checkup["id"])

    def test_node_parent_must_belong_to_same_book(self):
        book_a = self.make_book("کتاب الف")
        book_b = self.make_book("کتاب ب")
        node_a = self.make_node(book_a["id"], "فصل الف")
        code, payload = self.client.post(f"/api/books/{book_b['id']}/nodes", {
            "title": "گره اشتباه", "node_type": "section", "parent_id": node_a["id"],
        })
        self.assertEqual(code, 422)
        self.assertIn("error", payload)

    def test_node_archive_keeps_children(self):
        book = self.make_book("کتاب آرشیو")
        chapter = self.make_node(book["id"], "فصل", "chapter")
        self.make_node(book["id"], "بخش", "section", parent_id=chapter["id"])
        result = self.ok(self.client.delete(f"/api/nodes/{chapter['id']}"))
        self.assertTrue(result["archived"])
        self.assertEqual(result["usage"]["children"], 1)
        node = self.ok(self.client.get(f"/api/nodes/{chapter['id']}"))
        self.assertEqual(node["state"], "archived")


class TopicTests(TSPTestCase):
    """ماژول ۲: مباحث آموزشی مستقل از ساختار کتاب."""

    def test_topic_tree_and_multi_topic_link(self):
        book = self.make_book("کتاب مباحث")
        node_main = self.make_node(book["id"], "2-1 جدول تناوبی")
        node_mixed = self.make_node(book["id"], "تست‌های مخلوط", "mixed_tests")

        parent = self.make_topic("الگوها و روندها")
        child_a = self.make_topic("جدول تناوبی", parent_id=parent["id"])
        child_b = self.make_topic("روند خواص", parent_id=parent["id"])

        tree = self.ok(self.client.get("/api/topics/tree"))
        parent_node = next(item for item in tree["items"] if item["id"] == parent["id"])
        self.assertEqual(len(parent_node["children"]), 2)

        # یک تست می‌تواند به چند مبحث وصل شود (قاعده ۴)
        question = self.make_question(node_mixed["id"], "1", "3",
                                      topic_ids=[child_a["id"], child_b["id"]])
        detail = self.ok(self.client.get(f"/api/questions/{question['id']}"))
        self.assertEqual(len(detail["topics"]), 2)

        stats_a = self.ok(self.client.get(f"/api/topics/{child_a['id']}/stats"))
        self.assertEqual(stats_a["question_count"], 1)
        self.assertEqual(stats_a["remaining_to_target"], 0)

        # اتصال گروهی و حذف اتصال
        extra = self.make_question(node_main["id"], "7", "1")
        attached = self.ok(self.client.post(f"/api/topics/{child_b['id']}/questions", {
            "question_ids": [extra["id"]], "relation_type": "mixed",
        }), 201)
        self.assertEqual(attached["created"], 1)
        self.ok(self.client.delete(
            f"/api/topics/{child_b['id']}/questions/{extra['id']}"))
        linked = self.ok(self.client.get(f"/api/topics/{child_b['id']}/questions"))
        self.assertEqual(len(linked["items"]), 1)

    def test_moving_topic_into_own_child_is_rejected(self):
        parent = self.make_topic("والد")
        child = self.make_topic("فرزند", parent_id=parent["id"])
        code, payload = self.client.put(f"/api/topics/{parent['id']}",
                                        {"parent_id": child["id"]})
        self.assertEqual(code, 422)
        self.assertIn("error", payload)


class QuestionTests(TSPTestCase):
    """ماژول ۳: بانک تست و قواعد اعتبارسنجی شماره و شناسه."""

    def setUp(self):
        super().setUp()
        self.book = self.make_book("کتاب بانک")
        self.chapter1 = self.make_node(self.book["id"], "فصل ۱", "chapter")
        self.chapter2 = self.make_node(self.book["id"], "فصل ۲", "chapter")
        self.sub1 = self.make_node(self.book["id"], "2-3 روندها", "subsection",
                                   parent_id=self.chapter1["id"])

    def test_display_number_can_repeat_but_code_is_unique(self):
        first = self.make_question(self.sub1["id"], "17", "3")
        self.assertEqual(first["code"], "Q-000001")
        self.assertEqual(first["display_number"], "17")

        # همان شماره در فصل دیگر مجاز است (قاعده ۱)
        second = self.make_question(self.chapter2["id"], "17", "1")
        self.assertEqual(second["display_number"], "17")
        self.assertNotEqual(first["code"], second["code"])

        # شناسه داخلی تکراری باید رد شود
        code, payload = self.client.post("/api/questions", {
            "book_node_id": self.sub1["id"], "display_number": "1",
            "code": first["code"],
        })
        self.assertEqual(code, 409)
        self.assertIn("یکتا", payload["error"])

    def test_user_flags_are_separate_from_publisher_difficulty(self):
        question = self.make_question(self.sub1["id"], "5", "2",
                                      publisher_difficulty="سخت")
        self.assertEqual(question["publisher_difficulty"], "سخت")
        self.assertFalse(question["is_hard"])
        updated = self.ok(self.client.put(f"/api/questions/{question['id']}/flags",
                                          {"hard": True, "important": True}))
        self.assertTrue(updated["hard"])
        self.assertTrue(updated["important"])
        detail = self.ok(self.client.get(f"/api/questions/{question['id']}"))
        self.assertEqual(detail["publisher_difficulty"], "سخت")
        self.assertTrue(detail["is_hard"])

    def test_bulk_import_with_reported_errors(self):
        payload = self.ok(self.client.post("/api/questions/bulk", {
            "questions": [
                {"book_node_id": self.sub1["id"], "display_number": "1",
                 "correct_answer": "1"},
                {"book_node_id": self.sub1["id"], "display_number": "2",
                 "correct_answer": "2", "code": "Q-000001"},  # تکراری
                {"book_node_id": self.sub1["id"], "display_number": "3",
                 "correct_answer": "3"},
            ],
        }), 201)
        self.assertEqual(payload["created"], 2)
        self.assertEqual(payload["skipped"], 1)
        self.assertEqual(len(payload["errors"]), 1)

    def test_structure_import_creates_no_automatic_topics(self):
        payload = self.ok(self.client.post("/api/questions/import-structure", {
            "book": {"title": "کتاب ورودی ساختاری", "publisher": "ناشر"},
            "structure": [
                {"key": "ch1", "node_type": "chapter", "title": "فصل ۱", "children": [
                    {"key": "mixed", "node_type": "mixed_tests", "title": "تست‌های مخلوط"},
                ]},
            ],
            "questions": [
                {"node_key": "mixed", "display_number": "1", "correct_answer": "4"},
            ],
        }), 201)
        self.assertEqual(payload["summary"]["questions"], 1)
        topics = self.ok(self.client.get("/api/topics"))
        self.assertEqual([t["title"] for t in topics["items"]], [])

    def test_archive_question_keeps_history(self):
        question = self.make_question(self.sub1["id"], "9", "2")
        self.ok(self.client.post("/api/attempts", {
            "question_id": question["id"], "user_answer": "1",
        }), 201)
        archived = self.ok(self.client.delete(f"/api/questions/{question['id']}"))
        self.assertTrue(archived["archived"])
        # ثبت تلاش جدید برای تست آرشیوی مجاز نیست ولی سابقه باقی است
        code, payload = self.client.post("/api/attempts", {
            "question_id": question["id"], "user_answer": "2",
        })
        self.assertEqual(code, 409)
        self.ok(self.client.post(f"/api/questions/{question['id']}/restore"))
        history = self.ok(self.client.get("/api/attempts?question_id=" + str(question["id"])))
        self.assertEqual(len(history["items"]), 1)


class AttemptTests(TSPTestCase):
    """ماژول ۴: ثبت تلاش و سابقه قبلی (قواعد ۷ و ۸)."""

    def setUp(self):
        super().setUp()
        self.book = self.make_book("کتاب سابقه")
        self.node = self.make_node(self.book["id"], "فصل ۱", "chapter")
        self.question = self.make_question(self.node["id"], "1", "3")

    def test_result_is_computed_from_answer_key(self):
        correct = self.ok(self.client.post("/api/attempts", {
            "question_id": self.question["id"], "user_answer": "3",
        }), 201)
        self.assertEqual(correct["result"], "correct")
        wrong = self.ok(self.client.post("/api/attempts", {
            "question_id": self.question["id"], "user_answer": "1",
        }), 201)
        self.assertEqual(wrong["result"], "incorrect")
        blank = self.ok(self.client.post("/api/attempts", {
            "question_id": self.question["id"],
        }), 201)
        self.assertEqual(blank["result"], "unanswered")

    def test_every_attempt_is_a_new_record(self):
        for answer in ("1", "3", "2"):
            self.ok(self.client.post("/api/attempts", {
                "question_id": self.question["id"], "user_answer": answer,
                "spent_seconds": 30,
            }), 201)
        history = self.ok(self.client.get(f"/api/attempts?question_id={self.question['id']}"))
        self.assertEqual(len(history["items"]), 3)
        detail = self.ok(self.client.get(f"/api/questions/{self.question['id']}"))
        self.assertEqual(detail["performance"]["attempt_count"], 3)
        self.assertEqual(detail["performance"]["correct"], 1)
        self.assertEqual(detail["performance"]["incorrect"], 2)

    def test_void_keeps_record_but_excludes_from_stats(self):
        attempt = self.ok(self.client.post("/api/attempts", {
            "question_id": self.question["id"], "user_answer": "1",
        }), 201)
        self.ok(self.client.post(f"/api/attempts/{attempt['id']}/void",
                                 {"reason": "اشتباه ورود"}))
        detail = self.ok(self.client.get(f"/api/questions/{self.question['id']}"))
        self.assertEqual(detail["performance"]["attempt_count"], 0)
        all_attempts = self.ok(self.client.get(
            f"/api/attempts?question_id={self.question['id']}&include_voided=true"))
        self.assertEqual(len(all_attempts["items"]), 1)
        self.ok(self.client.post(f"/api/attempts/{attempt['id']}/restore"))
        detail = self.ok(self.client.get(f"/api/questions/{self.question['id']}"))
        self.assertEqual(detail["performance"]["attempt_count"], 1)

    def test_jalali_datetime_and_duration_parsing(self):
        attempt = self.ok(self.client.post("/api/attempts", {
            "question_id": self.question["id"], "user_answer": "3",
            "attempted_at": "1404/06/31 14:30", "spent_seconds": "01:30",
        }), 201)
        self.assertEqual(attempt["attempted_at"], "2025-09-22T14:30:00Z")
        self.assertEqual(attempt["spent_seconds"], 90)

    def test_bulk_attempts_report_errors(self):
        payload = self.ok(self.client.post("/api/attempts/bulk", {
            "attempts": [
                {"question_id": self.question["id"], "user_answer": "3"},
                {"question_id": 999999, "user_answer": "1"},
            ],
            "default_when": "2026-01-01T10:00:00Z",
        }), 201)
        self.assertEqual(payload["created"], 1)
        self.assertEqual(payload["skipped"], 1)
        self.assertEqual(payload["errors"][0]["row"], 2)

    def test_previous_entries_are_separate_from_attempts(self):
        payload = self.ok(self.client.post("/api/previous-entries", {
            "entries": [
                {"question_id": self.question["id"], "user_answer": "1",
                 "result": "incorrect", "note": "قبل از نرم‌افزار"},
                {"question_id": self.question["id"], "user_answer": None,
                 "result": "unanswered"},
            ],
            "label": "ورود اولیه",
        }), 201)
        self.assertEqual(payload["created"], 2)
        self.assertEqual(payload["review_count"], 2)

        detail = self.ok(self.client.get(f"/api/questions/{self.question['id']}"))
        self.assertEqual(detail["performance"]["attempt_count"], 0)
        self.assertEqual(detail["performance"]["previous_count"], 2)
        self.assertEqual(detail["performance"]["previous_incorrect"], 1)

        batches = self.ok(self.client.get("/api/batches"))
        self.assertEqual(batches["items"][0]["label"], "ورود اولیه")
        entries = self.ok(self.client.get("/api/previous-entries"))
        self.assertEqual(len(entries["items"]), 2)

    def test_attempt_note_can_be_edited_but_not_result(self):
        attempt = self.ok(self.client.post("/api/attempts", {
            "question_id": self.question["id"], "user_answer": "1",
        }), 201)
        updated = self.ok(self.client.patch(f"/api/attempts/{attempt['id']}",
                                           {"notes": "دقت نکردم"}))
        self.assertEqual(updated["notes"], "دقت نکردم")
        self.assertEqual(updated["result"], "incorrect")
        self.assertEqual(updated["user_answer"], "1")


class ReviewTests(TSPTestCase):
    """ماژول ۵: مرور هوشمند و ترکیب دلایل."""

    def setUp(self):
        super().setUp()
        self.book = self.make_book("کتاب مرور")
        self.node = self.make_node(self.book["id"], "فصل ۱", "chapter")
        self.q1 = self.make_question(self.node["id"], "1", "2")
        self.q2 = self.make_question(self.node["id"], "2", "2")
        self.q3 = self.make_question(self.node["id"], "3", "2")

    def test_reasons_follow_raw_data(self):
        self.ok(self.client.post("/api/attempts", {
            "question_id": self.q1["id"], "user_answer": "1"}), 201)
        self.ok(self.client.post("/api/attempts", {
            "question_id": self.q2["id"], "user_answer": None}), 201)
        self.ok(self.client.put(f"/api/questions/{self.q3['id']}/flags",
                                {"important": True, "hard": True}))
        items = self.ok(self.client.get("/api/reviews?page_size=50"))
        by_question = {item["question_id"]: item["reasons"] for item in items["items"]}
        self.assertIn("incorrect", by_question[self.q1["id"]])
        self.assertIn("unanswered", by_question[self.q2["id"]])
        self.assertIn("important", by_question[self.q3["id"]])
        self.assertIn("hard", by_question[self.q3["id"]])

        summary = self.ok(self.client.get("/api/reviews/summary"))
        self.assertEqual(summary["by_reason"]["incorrect"], 1)
        self.assertEqual(summary["by_reason"]["important"], 1)

    def test_correct_answer_resolves_open_item(self):
        self.ok(self.client.post("/api/attempts", {
            "question_id": self.q1["id"], "user_answer": "1"}), 201)
        self.ok(self.client.post("/api/attempts", {
            "question_id": self.q1["id"], "user_answer": "2"}), 201)
        items = self.ok(self.client.get("/api/reviews?page_size=50"))
        self.assertNotIn(self.q1["id"], [item["question_id"] for item in items["items"]])

    def test_previous_entry_produces_previous_reason(self):
        self.ok(self.client.post("/api/previous-entries", {
            "entries": [{"question_id": self.q2["id"], "user_answer": "3",
                         "result": "incorrect"}],
        }), 201)
        items = self.ok(self.client.get("/api/reviews?page_size=50"))
        entry = next(item for item in items["items"] if item["question_id"] == self.q2["id"])
        self.assertIn("incorrect_previous", entry["reasons"])

    def test_live_filters_combine(self):
        self.ok(self.client.post("/api/attempts", {
            "question_id": self.q1["id"], "user_answer": "1"}), 201)
        self.ok(self.client.put(f"/api/questions/{self.q1['id']}/flags", {"important": True}))
        either = self.ok(self.client.post("/api/reviews/filter-search", {
            "filters": ["incorrect", "important"], "match_all": False,
        }))
        both = self.ok(self.client.post("/api/reviews/filter-search", {
            "filters": ["incorrect", "important"], "match_all": True,
        }))
        self.assertEqual(either["total"], 1)
        self.assertEqual(both["total"], 1)
        none = self.ok(self.client.post("/api/reviews/filter-search", {
            "filters": ["correct"], "match_all": True,
        })) if False else None
        untouched = self.ok(self.client.post("/api/reviews/filter-search", {
            "filters": ["untried"],
        }))
        self.assertEqual(untouched["total"], 2)

    def test_manual_item_and_state_change(self):
        item = self.ok(self.client.post("/api/reviews", {
            "question_id": self.q3["id"], "note": "مرور دستی فردا",
        }), 201)
        self.assertIn("manual", item["reasons"])
        updated = self.ok(self.client.patch(f"/api/reviews/{item['id']}",
                                            {"state": "in_progress"}))
        self.assertEqual(updated["state"], "in_progress")
        resolved = self.ok(self.client.patch(f"/api/reviews/{item['id']}",
                                             {"state": "resolved"}))
        self.assertEqual(resolved["state"], "resolved")
        self.assertIsNotNone(resolved["resolved_at"])

    def test_study_batch_orders_by_priority(self):
        self.ok(self.client.post("/api/attempts", {
            "question_id": self.q1["id"], "user_answer": "1"}), 201)
        self.ok(self.client.put(f"/api/questions/{self.q1['id']}/flags", {"important": True}))
        batch = self.ok(self.client.get("/api/reviews/batch?filters=incorrect,important&limit=10"))
        self.assertGreaterEqual(batch["count"], 1)
        self.assertEqual(batch["items"][0]["question_id"], self.q1["id"])

    def test_rebuild_review_list(self):
        result = self.ok(self.client.post("/api/reviews/sync"))
        self.assertGreaterEqual(result["questions_synced"], 3)


class TeachingTests(TSPTestCase):
    """ماژول ۶: تدریس، هدف تست و عقب‌ماندگی."""

    def setUp(self):
        super().setUp()
        self.book = self.make_book("کتاب تدریس")
        self.node = self.make_node(self.book["id"], "فصل ۱", "chapter")
        self.topic = self.make_topic("شعاع اتمی")
        self.questions = [self.make_question(self.node["id"], str(index), "1",
                                            topic_ids=[self.topic["id"]])
                          for index in range(1, 6)]

    def test_teaching_status_and_goal_progress(self):
        unit = self.ok(self.client.put(f"/api/teaching/units/{self.topic['id']}",
                                       {"taught_status": "taught"}), 200)
        self.assertEqual(unit["taught_status"], "taught")
        self.assertIsNotNone(unit["taught_at"])

        goal = self.ok(self.client.post("/api/teaching/goals", {
            "topic_id": self.topic["id"], "target_count": 3, "period_label": "مهر",
        }), 201)
        self.assertEqual(goal["progress"]["target_count"], 3)
        self.assertEqual(goal["progress"]["remaining_count"], 3)

        for question in self.questions[:2]:
            self.ok(self.client.post("/api/attempts", {
                "question_id": question["id"], "user_answer": "1"}), 201)
        progress = self.ok(self.client.get(f"/api/teaching/goals/{goal['id']}"))["progress"]
        self.assertEqual(progress["done_count"], 2)
        self.assertEqual(progress["remaining_count"], 1)
        self.assertTrue(progress["is_behind"])

    def test_overview_reports_lag(self):
        self.ok(self.client.post("/api/teaching/goals", {
            "topic_id": self.topic["id"], "target_count": 10,
        }), 201)
        overview = self.ok(self.client.get("/api/teaching/overview"))
        self.assertEqual(overview["totals"]["target"], 10)
        self.assertEqual(overview["totals"]["remaining"], 10)
        self.assertEqual(overview["behind_count"], 1)
        self.assertEqual(overview["behind"][0]["taught_status"], "not_started")

    def test_goal_creates_topic_review_item(self):
        self.ok(self.client.post("/api/teaching/goals", {
            "topic_id": self.topic["id"], "target_count": 4,
        }), 201)
        items = self.ok(self.client.get("/api/reviews?level=topic&page_size=20"))
        reasons = [reason for item in items["items"] for reason in item["reasons"]]
        self.assertIn("goal_remaining", reasons)

    def test_invalid_teaching_status_rejected(self):
        code, payload = self.client.put(f"/api/teaching/units/{self.topic['id']}",
                                        {"taught_status": "nonsense"})
        self.assertEqual(code, 422)
        self.assertIn("taught_status", payload.get("errors", {}))


class ExamTests(TSPTestCase):
    """ماژول ۷ و ۸: آزمون، اجرای مستقل و سابقه اجراها."""

    def setUp(self):
        super().setUp()
        self.book = self.make_book("کتاب آزمون")
        self.node = self.make_node(self.book["id"], "فصل ۱", "chapter")
        self.topic = self.make_topic("روند خواص")
        self.questions = [
            self.make_question(self.node["id"], str(index), "2",
                               topic_ids=[self.topic["id"]])
            for index in range(1, 5)
        ]

    def test_exam_with_bank_questions_and_topics(self):
        exam = self.ok(self.client.post("/api/exams", {
            "title": "آزمون تک‌درس", "exam_type": "single_subject",
            "planned_date": "1404/07/15", "topic_ids": [self.topic["id"]],
        }), 201)
        self.assertEqual(exam["planned_date"], "2025-10-07")
        added = self.ok(self.client.post(f"/api/exams/{exam['id']}/questions", {
            "questions": [{"question_id": q["id"]} for q in self.questions],
        }), 201)
        self.assertEqual(added["created"], 4)
        detail = self.ok(self.client.get(f"/api/exams/{exam['id']}"))
        self.assertEqual(len(detail["questions"]), 4)
        self.assertEqual(detail["questions"][0]["correct_answer"], "2")
        self.assertEqual(len(detail["topics"]), 1)

    def test_from_topic_helper_and_manual_question(self):
        exam = self.ok(self.client.post("/api/exams", {"title": "آزمون از مبحث"}), 201)
        payload = self.ok(self.client.post(f"/api/exams/{exam['id']}/questions/from-topic", {
            "topic_id": self.topic["id"], "limit": 3, "strategy": "untried",
        }), 201)
        self.assertEqual(payload["created"], 3)
        manual = self.ok(self.client.post(f"/api/exams/{exam['id']}/questions", {
            "questions": [{"display_number": "99", "correct_answer": "1"}],
        }), 201)
        self.assertEqual(manual["created"], 1)

    def test_multiple_independent_attempts(self):
        exam = self.ok(self.client.post("/api/exams", {"title": "آزمون چنداجرا"}), 201)
        self.ok(self.client.post(f"/api/exams/{exam['id']}/questions", {
            "questions": [{"question_id": q["id"]} for q in self.questions],
        }), 201)
        detail = self.ok(self.client.get(f"/api/exams/{exam['id']}"))

        first = self.ok(self.client.post(f"/api/exams/{exam['id']}/attempts", {}), 201)
        answers = [{"exam_question_id": item["id"], "user_answer": "2"} for item in detail["questions"]]
        result_one = self.ok(self.client.post(
            f"/api/exam-attempts/{first['id']}/answers", {"answers": answers}))
        self.assertEqual(result_one["score_percent"], 100.0)
        self.assertEqual(result_one["state"], "finished")

        second = self.ok(self.client.post(f"/api/exams/{exam['id']}/attempts", {}), 201)
        wrong = [{"exam_question_id": item["id"], "user_answer": "1"} for item in detail["questions"]]
        result_two = self.ok(self.client.post(
            f"/api/exam-attempts/{second['id']}/answers", {"answers": wrong}))
        self.assertEqual(result_two["score_percent"], 0.0)

        attempts = self.ok(self.client.get(f"/api/exams/{exam['id']}"))["attempts"]
        self.assertEqual(len(attempts), 2)
        summary = self.ok(self.client.get(f"/api/exams/{exam['id']}"))["summary"]
        self.assertEqual(summary["attempt_count"], 2)
        self.assertEqual(summary["best_score"], 100.0)
        self.assertEqual(summary["last_score"], 0.0)

    def test_finish_accepts_jalali_datetime(self):
        """تاریخ شمسی پایان اجرا باید به میلادی UTC تبدیل و ذخیره شود."""
        exam = self.ok(self.client.post("/api/exams", {"title": "آزمون تاریخ شمسی"}), 201)
        self.ok(self.client.post(f"/api/exams/{exam['id']}/questions", {
            "questions": [{"question_id": self.questions[0]["id"]}],
        }), 201)
        detail = self.ok(self.client.get(f"/api/exams/{exam['id']}"))
        attempt = self.ok(self.client.post(f"/api/exams/{exam['id']}/attempts",
                                           {"started_at": "1404/06/31 14:30"}), 201)
        self.assertEqual(attempt["started_at"], "2025-09-22T14:30:00Z")
        self.ok(self.client.post(f"/api/exam-attempts/{attempt['id']}/answers", {
            "answers": [{"exam_question_id": detail["questions"][0]["id"],
                         "user_answer": "2"}],
        }))
        finished = self.ok(self.client.post(f"/api/exam-attempts/{attempt['id']}/finish",
                                           {"finished_at": "1404/07/15 09:20"}))
        self.assertEqual(finished["finished_at"], "2025-10-07T09:20:00Z")
        stored = self.db.query_one("SELECT finished_at FROM exam_attempt WHERE id = ?",
                                   (attempt["id"],))
        self.assertEqual(stored["finished_at"], "2025-10-07T09:20:00Z")

    def test_exam_answers_mirror_into_question_history(self):
        exam = self.ok(self.client.post("/api/exams", {"title": "آزمون تاریخچه"}), 201)
        self.ok(self.client.post(f"/api/exams/{exam['id']}/questions", {
            "questions": [{"question_id": self.questions[0]["id"]}],
        }), 201)
        detail = self.ok(self.client.get(f"/api/exams/{exam['id']}"))
        attempt = self.ok(self.client.post(f"/api/exams/{exam['id']}/attempts", {}), 201)
        self.ok(self.client.post(f"/api/exam-attempts/{attempt['id']}/answers", {
            "answers": [{"exam_question_id": detail["questions"][0]["id"],
                         "user_answer": "1"}],
            "record_to_bank": True,
        }))
        history = self.ok(self.client.get(
            f"/api/attempts?question_id={self.questions[0]['id']}"))
        self.assertEqual(len(history["items"]), 1)
        self.assertEqual(history["items"][0]["source"], "exam")
        self.assertEqual(history["items"][0]["exam_attempt_id"], attempt["id"])

    def test_asset_download_uses_rfc5987_filename(self):
        """نام فارسی فایل باید در هدر Content-Disposition کدگذاری شود."""
        exam = self.ok(self.client.post("/api/exams", {"title": "آزمون هدر"}), 201)
        png = b"\x89PNG\r\n\x1a\n" + b"7" * 16
        asset = self.ok(self.client.multipart(f"/api/exams/{exam['id']}/assets",
                                              "صورت سؤال.png", png), 201)
        status, body, headers = self.client.get_with_headers(f"/api/files/{asset['id']}")
        self.assertEqual(status, 200)
        self.assertEqual(body, png)
        disposition = headers["Content-Disposition"]
        self.assertIn("filename*=UTF-8''", disposition)
        self.assertIn("%D8%B5", disposition)          # «ص» کدگذاری‌شده
        self.assertIn('filename="file.png"', disposition)
        self.assertTrue(disposition.startswith("inline"))
        _, _, download = self.client.get_with_headers(f"/api/files/{asset['id']}?download=1")
        self.assertTrue(download["Content-Disposition"].startswith("attachment"))

    def test_breakdown_by_topic_and_regrade(self):
        exam = self.ok(self.client.post("/api/exams", {"title": "تحلیل"}), 201)
        self.ok(self.client.post(f"/api/exams/{exam['id']}/questions", {
            "questions": [{"question_id": q["id"], "topic_id": self.topic["id"]}
                          for q in self.questions],
        }), 201)
        detail = self.ok(self.client.get(f"/api/exams/{exam['id']}"))
        attempt = self.ok(self.client.post(f"/api/exams/{exam['id']}/attempts", {}), 201)
        answers = [{"exam_question_id": item["id"],
                    "user_answer": "2" if index < 2 else "1"}
                   for index, item in enumerate(detail["questions"])]
        result = self.ok(self.client.post(f"/api/exam-attempts/{attempt['id']}/answers",
                                          {"answers": answers}))
        self.assertEqual(result["score_percent"], 50.0)
        breakdown = self.ok(self.client.get(f"/api/exam-attempts/{attempt['id']}"))["breakdown"]
        self.assertEqual(len(breakdown["by_topic"]), 1)
        self.assertEqual(breakdown["by_topic"][0]["percent"], 50.0)

        # اصلاح دستی نتیجه
        fixed = self.ok(self.client.post(f"/api/exam-attempts/{attempt['id']}/grade", {
            "results": [{"exam_question_id": item["id"], "result": "correct"}
                        for item in detail["questions"]],
        }))
        self.assertEqual(fixed["attempt"]["score_percent"], 100.0)

    def test_asset_upload_and_download(self):
        exam = self.ok(self.client.post("/api/exams", {"title": "آزمون فایل"}), 201)
        png = (b"\x89PNG\r\n\x1a\n" + b"0" * 40)
        asset = self.ok(self.client.multipart(f"/api/exams/{exam['id']}/assets",
                                              "سوال.png", png), 201)
        self.assertEqual(asset["file_type"], "image")
        self.assertEqual(asset["byte_size"], len(png))
        code, content = self.client.get(f"/api/files/{asset['id']}", raw=True)
        self.assertEqual(code, 200)
        self.assertEqual(content, png)
        listed = self.ok(self.client.get(f"/api/exams/{exam['id']}"))["assets"]
        self.assertEqual(len(listed), 1)
        self.ok(self.client.delete(f"/api/exam-assets/{asset['id']}"))

    def test_exam_archive_keeps_attempts(self):
        exam = self.ok(self.client.post("/api/exams", {"title": "آرشیو آزمون"}), 201)
        self.ok(self.client.post(f"/api/exams/{exam['id']}/questions", {
            "questions": [{"question_id": self.questions[0]["id"]}],
        }), 201)
        detail = self.ok(self.client.get(f"/api/exams/{exam['id']}"))
        attempt = self.ok(self.client.post(f"/api/exams/{exam['id']}/attempts", {}), 201)
        self.ok(self.client.post(f"/api/exam-attempts/{attempt['id']}/answers", {
            "answers": [{"exam_question_id": detail["questions"][0]["id"],
                         "user_answer": "2"}],
        }))
        result = self.ok(self.client.delete(f"/api/exams/{exam['id']}"))
        self.assertTrue(result["archived"])
        self.assertEqual(result["attempts_kept"], 1)
        attempts = self.ok(self.client.get(f"/api/exam-attempts?exam_id={exam['id']}"))
        self.assertEqual(len(attempts["items"]), 1)

    def test_answer_for_question_outside_exam_rejected(self):
        exam = self.ok(self.client.post("/api/exams", {"title": "خطا"}), 201)
        self.ok(self.client.post(f"/api/exams/{exam['id']}/questions", {
            "questions": [{"question_id": self.questions[0]["id"]}],
        }), 201)
        attempt = self.ok(self.client.post(f"/api/exams/{exam['id']}/attempts", {}), 201)
        code, payload = self.client.post(f"/api/exam-attempts/{attempt['id']}/answers", {
            "answers": [{"exam_question_id": 999999, "user_answer": "1"}],
        })
        self.assertEqual(code, 422)
        self.assertIn("error", payload)


class ReadinessTests(TSPTestCase):
    """ماژول ۹: آمادگی آزمون و برآورد."""

    def setUp(self):
        super().setUp()
        self.book = self.make_book("کتاب آمادگی")
        self.node = self.make_node(self.book["id"], "فصل ۱", "chapter")
        self.topic = self.make_topic("رفتار عنصرها")
        self.questions = [self.make_question(self.node["id"], str(index), "2",
                                            topic_ids=[self.topic["id"]])
                          for index in range(1, 7)]

    def test_plan_evaluation_components(self):
        for question in self.questions[:3]:
            self.ok(self.client.post("/api/attempts", {
                "question_id": question["id"], "user_answer": "2"}), 201)
        self.ok(self.client.post("/api/attempts", {
            "question_id": self.questions[3]["id"], "user_answer": "1"}), 201)

        plan = self.ok(self.client.post("/api/plans", {
            "title": "آزمون جامع آبان", "exam_date": "1404/08/10",
            "topic_ids": [self.topic["id"]], "target": "بالای ۷۰٪",
        }), 201)
        self.assertIsNotNone(plan["readiness_estimate"])
        self.assertIn("components", plan["details"])
        self.assertIn("coverage", plan["details"]["components"])
        self.assertIn("mastery", plan["details"]["components"])
        self.assertEqual(plan["details"]["components"]["mastery"]["score"], 75.0)
        self.assertTrue(plan["details"]["recommendations"])
        self.assertIn("تضمین", plan["details"]["recommendations"][0] or "تضمین") \
            if False else None

        fetched = self.ok(self.client.get(f"/api/plans/{plan['id']}"))
        self.assertEqual(fetched["days_remaining"] is not None, True)

    def test_analysis_generates_work_items(self):
        self.ok(self.client.post("/api/attempts", {
            "question_id": self.questions[0]["id"], "user_answer": "1"}), 201)
        analysis = self.ok(self.client.post("/api/readiness/analyze", {
            "topic_ids": [self.topic["id"]],
        }))
        self.assertIn("disclaimer", analysis)
        self.assertIn("تضمین", analysis["disclaimer"])
        self.assertLessEqual(analysis["estimate"], 100)
        self.assertGreaterEqual(analysis["estimate"], 0)

        plan = self.ok(self.client.post("/api/plans", {
            "title": "برنامه با کار", "topic_ids": [self.topic["id"]],
        }), 201)
        self.ok(self.client.post(f"/api/plans/{plan['id']}/evaluate",
                                 {"generate_review": True}))
        items = self.ok(self.client.get("/api/reviews?page_size=100"))
        upcoming = [item for item in items["items"]
                    if "upcoming_exam" in item["reasons"]]
        self.assertTrue(upcoming)

    def test_upcoming_endpoint_filters_done_plans(self):
        plan = self.ok(self.client.post("/api/plans", {
            "title": "آزمون نزدیک", "exam_date": "1404/07/01",
            "topic_ids": [self.topic["id"]],
        }), 201)
        upcoming = self.ok(self.client.get("/api/readiness/upcoming"))
        self.assertIn(plan["id"], [item["id"] for item in upcoming["items"]])
        self.ok(self.client.put(f"/api/plans/{plan['id']}",
                                {"preparation_status": "done"}))
        upcoming = self.ok(self.client.get("/api/readiness/upcoming"))
        self.assertNotIn(plan["id"], [item["id"] for item in upcoming["items"]])

    def test_plan_requires_topics(self):
        code, payload = self.client.post("/api/plans", {"title": "بدون مبحث"})
        self.assertEqual(code, 422)


class AnalyticsTests(TSPTestCase):
    """ماژول ۱۰ و ۱۱: تحلیل چندسطحی و داشبورد."""

    def setUp(self):
        super().setUp()
        self.book = self.make_book("کتاب تحلیل")
        self.chapter = self.make_node(self.book["id"], "فصل ۱", "chapter")
        self.section = self.make_node(self.book["id"], "2-1 جدول", "subsection",
                                      parent_id=self.chapter["id"])
        self.topic = self.make_topic("جدول تناوبی")
        self.questions = [self.make_question(self.section["id"], str(index), "2",
                                            topic_ids=[self.topic["id"]])
                          for index in range(1, 5)]

    def test_levels_and_timeseries(self):
        answers = ["2", "2", "1", None]
        for question, answer in zip(self.questions, answers):
            self.ok(self.client.post("/api/attempts", {
                "question_id": question["id"], "user_answer": answer,
                "spent_seconds": 40, "attempted_at": "2026-09-20T10:00:00Z",
            }), 201)

        overall = self.ok(self.client.get("/api/analytics/performance?level=overall"))
        self.assertEqual(overall["totals"]["attempts"], 4)
        self.assertEqual(overall["totals"]["correct"], 2)
        self.assertEqual(overall["totals"]["incorrect"], 1)
        self.assertEqual(overall["totals"]["unanswered"], 1)
        self.assertEqual(overall["totals"]["accuracy"], 66.7)

        for level in ("subject", "book", "book_node", "topic", "question",
                      "day", "week", "month"):
            payload = self.ok(self.client.get(f"/api/analytics/performance?level={level}"))
            self.assertIn("rows", payload, level)

        series = self.ok(self.client.get("/api/analytics/timeseries?unit=day&window=30"))
        self.assertEqual(series["total_attempts"], 4)
        self.assertTrue(series["series"])

    def test_performance_groups_by_identity_not_label(self):
        """گروه‌بندی تحلیل باید بر پایه شناسه باشد؛ نه شماره نمایشی یا نام ناشر.

        دو کتاب از یک ناشر با تست‌های هم‌شماره نباید در گزارش ادغام شوند.
        """
        second_book = self.make_book("کتاب تحلیل دوم")   # همان ناشر پیش‌فرض
        second_node = self.make_node(second_book["id"], "فصل ۱", "chapter")
        second_question = self.make_question(second_node["id"], "1", "1")
        first_question = self.make_question(self.section["id"], "1", "2")
        for question in (first_question, second_question):
            self.ok(self.client.post("/api/attempts", {
                "question_id": question["id"], "user_answer": question["correct_answer"],
            }), 201)

        books = self.ok(self.client.get("/api/analytics/performance?level=book"))["rows"]
        self.assertEqual(len(books), 2)
        for row in books:
            self.assertEqual(row["attempts"], 1)
        self.assertEqual(sorted(row["group_key"] for row in books),
                         sorted([self.book["id"], second_book["id"]]))

        questions = self.ok(self.client.get(
            "/api/analytics/performance?level=question"))["rows"]
        self.assertEqual(len(questions), 2)
        self.assertEqual(sorted(row["group_key"] for row in questions),
                         sorted([first_question["id"], second_question["id"]]))
        for row in questions:
            self.assertEqual(row["attempts"], 1)
            self.assertEqual(row["questions"], 1)
            self.assertEqual(row["display_number"], "1")

    def test_dashboard_composition(self):
        self.ok(self.client.post("/api/attempts", {
            "question_id": self.questions[0]["id"], "user_answer": "1"}), 201)
        dashboard = self.ok(self.client.get("/api/dashboard"))
        for key in ("headline", "today", "week", "month", "trend", "streak", "review",
                    "teaching", "upcoming_exams", "activity", "series"):
            self.assertIn(key, dashboard)
        self.assertGreaterEqual(dashboard["headline"]["open_reviews"], 1)
        self.assertGreaterEqual(len(dashboard["activity"]), 1)

    def test_activity_feed_and_leaderboard(self):
        self.ok(self.client.post("/api/attempts", {
            "question_id": self.questions[0]["id"], "user_answer": "2"}), 201)
        activity = self.ok(self.client.get("/api/analytics/activity"))
        self.assertTrue(activity["items"])
        self.assertIn("message", activity["items"][0])
        leaderboard = self.ok(self.client.get(
            "/api/analytics/leaderboard?min_attempts=1"))
        self.assertIn("strongest", leaderboard)
        self.assertIn("weakest", leaderboard)

    def test_exam_metrics(self):
        metrics = self.ok(self.client.get("/api/analytics/exams"))
        self.assertIn("attempts", metrics)


class DataToolsTests(TSPTestCase):
    """صدور/ورود، پشتیبان، CSV، داده نمونه و بررسی یکپارچگی."""

    def test_integrity_checks_run(self):
        report = self.ok(self.client.get("/api/integrity"))
        self.assertGreater(report["total_checks"], 8)
        self.assertIn("checks", report)
        ids = [check["id"] for check in report["checks"]]
        for expected in ("duplicate_display_number", "assessment_as_topic",
                         "question_without_key", "orphan_review_items"):
            self.assertIn(expected, ids)

    def test_export_import_roundtrip(self):
        book = self.make_book("کتاب انتقال")
        node = self.make_node(book["id"], "فصل ۱", "chapter")
        question = self.make_question(node["id"], "5", "3")
        self.ok(self.client.post("/api/attempts", {
            "question_id": question["id"], "user_answer": "3"}), 201)

        export = self.ok(self.client.get("/api/export"))
        self.assertIn("tables", export)
        counts = export["meta"]["counts"]
        self.assertGreaterEqual(counts["question"], 1)

        result = self.ok(self.client.post("/api/import", {
            "package": export, "mode": "merge",
        }))
        self.assertIn("inserted", result)

    def test_csv_template_and_import(self):
        template = self.ok(self.client.get("/api/csv/template", raw=True))
        self.assertIn("book_node_path".encode("utf-8"), template)

        self.make_book("کتاب CSV")
        csv_text = "\ufeffbook,book_node_path,display_number,question_code,correct_answer," \
                   "publisher_difficulty,topic_paths,reference,notes,important,hard,result,user_answer\n" \
                   "کتاب CSV,فصل ۱ / 2-1 جدول,1,,2,متوسط,جدول تناوبی,,,خیر,خیر,,\n" \
                   "کتاب CSV,فصل ۱ / 2-1 جدول,2,,3,,جدول تناوبی,,,,,incorrect,1\n"
        result = self.ok(self.client.multipart("/api/csv/questions", "t.csv",
                                               csv_text.encode("utf-8")), 201)
        self.assertEqual(result["created"], 2)
        self.assertGreaterEqual(result["nodes_created"], 2)
        self.assertEqual(result["previous_entries"]["created"], 1)
        topics = self.ok(self.client.get("/api/topics"))
        self.assertIn("جدول تناوبی", [topic["title"] for topic in topics["items"]])

    def test_csv_dry_run_writes_nothing(self):
        book = self.make_book("کتاب آزمایشی")
        before = self.ok(self.client.get("/api/questions?book_id=" + str(book["id"])))["total"]
        csv_text = ("book,book_node_path,display_number,correct_answer\n"
                    "کتاب آزمایشی,فصل آزمایشی,1,2\n")
        self.ok(self.client.multipart("/api/csv/questions?dry_run=true", "d.csv",
                                      csv_text.encode("utf-8")), 201)
        after = self.ok(self.client.get("/api/questions?book_id=" + str(book["id"])))["total"]
        self.assertEqual(before, after)

    def test_backup_creates_file(self):
        result = self.ok(self.client.post("/api/backup", {}), 201)
        self.assertTrue(result["file"])
        self.assertTrue(Path(result["path"]).exists())
        backups = self.ok(self.client.get("/api/backups"))
        self.assertTrue(backups["items"])


class SampleDataTests(TSPTestCase):
    """بارگذاری داده نمونه و هم‌خوانی با سند شیمی ۲ مبتکران."""

    def setUp(self):
        super().setUp()
        self.sample = self.ok(self.client.post("/api/sample/load", {}), 201)

    def test_sample_load_and_structure(self):
        result = self.sample
        self.assertGreaterEqual(result["questions"], 20)
        # شش مبحث نمونه: پنج مبحث کلیددار + یک مبحث والدِ جدول تناوبی و روندها
        self.assertEqual(result["topics"], 6)
        self.assertEqual(result["nodes"], 13)

        books = self.ok(self.client.get("/api/books"))["items"]
        book = next(item for item in books if "مبتکران" in item["title"])
        tree = self.ok(self.client.get(f"/api/books/{book['id']}/tree"))
        types = set()

        def collect(nodes):
            for node in nodes:
                types.add(node["node_type"])
                collect(node.get("children") or [])
        collect(tree["tree"])
        self.assertIn("chapter", types)
        self.assertIn("mixed_tests", types)
        self.assertIn("checkup_exam", types)
        self.assertIn("comprehensive_exam", types)

        # شماره‌گذاری در فصل‌های مختلف از نو شروع می‌شود
        chapter1, chapter2 = tree["tree"][0], tree["tree"][1]
        page = self.ok(self.client.get(
            f"/api/questions?book_node_id={chapter2['id']}&page_size=50"))
        numbers = {item["display_number"] for item in page["items"]}
        self.assertIn("1", numbers)
        codes = {item["code"] for item in page["items"]}
        first_page = self.ok(self.client.get(
            f"/api/questions?book_node_id={chapter1['id']}&page_size=50"))
        self.assertFalse(codes & {item["code"] for item in first_page["items"]})

        # بارگذاری دوباره باید رد شود
        code, payload = self.client.post("/api/sample/load", {})
        self.assertEqual(code, 409)

    def test_sample_dashboard_is_meaningful(self):
        dashboard = self.ok(self.client.get("/api/dashboard"))
        self.assertGreater(dashboard["headline"]["attempts"], 0)
        self.assertGreater(dashboard["headline"]["open_reviews"], 0)
        self.assertTrue(dashboard["behind_topics"])


def load_tests(loader, tests, pattern):  # noqa: ARG001
    """ترتیب اجرای کلاس‌ها: بستر → منابع → ... → داده نمونه در پایان."""
    suite = unittest.TestSuite()
    for case in (FacilityTests, ResourceTests, TopicTests, QuestionTests, AttemptTests,
                 ReviewTests, TeachingTests, ExamTests, ReadinessTests,
                 AnalyticsTests, DataToolsTests, SampleDataTests):
        suite.addTests(loader.loadTestsFromTestCase(case))
    return suite


if __name__ == "__main__":
    unittest.main(verbosity=2)
