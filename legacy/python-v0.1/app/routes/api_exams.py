"""مسیرهای API ماژول ۷ و ۸ — آزمون، اجرای آزمون و فایل سؤال."""
from __future__ import annotations

import re
import uuid
from pathlib import Path

from .. import config
from ..core import ApiError, NotFound
from ..server import Request, Response, json_response, router
from ..services import exams
from .helpers import body, id_param, page_args, uploaded_bytes


def register() -> None:
    @router.get("/api/exams")
    def list_exams(request: Request):
        paging = page_args(request)
        return json_response(exams.list_exams(
            request.db, subject_id=request.q_int("subject_id"), status=request.q("status"),
            exam_type=request.q("exam_type"),
            upcoming_only=bool(request.q_bool("upcoming")),
            search=request.q("search"), **paging))

    @router.post("/api/exams")
    def create_exam(request: Request):
        return json_response(exams.create_exam(request.db, body(request)), 201)

    @router.get("/api/exams/{id}")
    def get_exam(request: Request):
        return json_response(exams.get_exam(request.db, id_param(request)))

    @router.put("/api/exams/{id}")
    def update_exam(request: Request):
        return json_response(exams.update_exam(request.db, id_param(request), body(request)))

    @router.delete("/api/exams/{id}")
    def delete_exam(request: Request):
        return json_response(exams.delete_exam(request.db, id_param(request)))

    @router.put("/api/exams/{id}/topics")
    def set_topics(request: Request):
        return json_response(exams.set_topics(request.db, id_param(request),
                                              body(request).get("topics") or []))

    @router.post("/api/exams/{id}/questions")
    def add_questions(request: Request):
        payload = body(request)
        return json_response(exams.add_questions(request.db, id_param(request),
                                                 payload.get("questions") or []), 201)

    @router.post("/api/exams/{id}/questions/from-topic")
    def add_from_topic(request: Request):
        payload = body(request)
        return json_response(exams.add_questions_from_topic(
            request.db, id_param(request), int(payload.get("topic_id")),
            limit=int(payload.get("limit") or 20),
            strategy=payload.get("strategy") or "untried"), 201)

    @router.patch("/api/exam-questions/{id}")
    def update_exam_question(request: Request):
        return json_response(exams.update_exam_question(request.db, id_param(request),
                                                        body(request)))

    @router.delete("/api/exam-questions/{id}")
    def remove_exam_question(request: Request):
        return json_response(exams.remove_exam_question(request.db, id_param(request)))

    # -- اجرای آزمون ---------------------------------------------------------
    @router.get("/api/exam-attempts")
    def list_attempts(request: Request):
        paging = page_args(request)
        return json_response({"items": exams.list_attempts(
            request.db, request.q_int("exam_id"),
            subject_id=request.q_int("subject_id"), **paging), **paging})

    @router.post("/api/exams/{id}/attempts")
    def start_attempt(request: Request):
        return json_response(exams.start_attempt(request.db, id_param(request),
                                                 body(request)), 201)

    @router.get("/api/exam-attempts/{id}")
    def get_attempt(request: Request):
        return json_response(exams.get_attempt(request.db, id_param(request)))

    @router.post("/api/exam-attempts/{id}/answers")
    def submit_answers(request: Request):
        payload = body(request)
        return json_response(exams.submit_answers(
            request.db, id_param(request), payload.get("answers") or [],
            record_to_bank=payload.get("record_to_bank", True) is not False,
            finalize=payload.get("finalize", True) is not False,
            spent_seconds=payload.get("spent_seconds"),
            finished_at=payload.get("finished_at")))

    @router.post("/api/exam-attempts/{id}/finish")
    def finish_attempt(request: Request):
        payload = body(request)
        return json_response(exams.finish_attempt(
            request.db, id_param(request), spent_seconds=payload.get("spent_seconds"),
            finished_at=payload.get("finished_at")))

    @router.post("/api/exam-attempts/{id}/grade")
    def grade_attempt(request: Request):
        return json_response(exams.grade_attempt_manual(
            request.db, id_param(request), body(request).get("results") or []))

    @router.post("/api/exam-attempts/{id}/archive")
    def archive_attempt(request: Request):
        return json_response(exams.archive_attempt(request.db, id_param(request)))

    # -- فایل سؤال (PDF/تصویر) ----------------------------------------------
    @router.post("/api/exams/{id}/assets")
    def upload_asset(request: Request):
        exam_id = id_param(request)
        data, filename, content_type = uploaded_bytes(request)
        if len(data) > config.MAX_UPLOAD_BODY:
            raise ApiError("حجم فایل بیش از حد مجاز است", 413)
        suffix = Path(filename or "").suffix.lower()
        image_suffixes = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp", ".tif", ".tiff"}
        if content_type.startswith("image/") or suffix in image_suffixes:
            file_type = "image"
        elif content_type == "application/pdf" or suffix == ".pdf":
            file_type = "pdf"
        else:
            file_type = "other"
        safe_name = re.sub(r"[^\w.\-آ-ی]", "_", Path(filename or "file").name)[:80]
        target_dir = config.UPLOAD_DIR / f"exam-{exam_id}"
        target_dir.mkdir(parents=True, exist_ok=True)
        target = target_dir / f"{uuid.uuid4().hex[:8]}-{safe_name or 'file'}"
        target.write_bytes(data)
        asset = exams.add_asset(
            request.db, exam_id, str(target.relative_to(config.DATA_DIR)),
            file_type=file_type, original_name=filename, byte_size=len(data),
            metadata={"content_type": content_type,
                      "exam_question_id": request.body.get("exam_question_id")},
            exam_question_id=_int_or_none(request.body.get("exam_question_id")))
        return json_response(asset, 201)

    @router.get("/api/exam-assets/{id}")
    def get_asset(request: Request):
        asset = request.db.query_one("SELECT * FROM exam_asset WHERE id = ?",
                                     (id_param(request),))
        if not asset:
            raise NotFound("فایل پیوست یافت نشد")
        return json_response(asset)

    @router.delete("/api/exam-assets/{id}")
    def delete_asset(request: Request):
        result = exams.delete_asset(request.db, id_param(request))
        path = config.DATA_DIR / result["file_path"]
        try:
            if path.exists():
                path.unlink()
        except OSError:
            pass
        return json_response(result)

    @router.get("/api/files/{id}")
    def serve_asset(request: Request):
        asset = request.db.query_one("SELECT * FROM exam_asset WHERE id = ?",
                                     (id_param(request),))
        if not asset:
            raise NotFound("فایل پیوست یافت نشد")
        # نام اصلی فارسی فایل هم در حالت نمایش و هم در حالت دانلود استفاده می‌شود
        original = asset["original_name"] or None
        wants_download = bool(request.q("download"))
        return Response(file_path=config.DATA_DIR / asset["file_path"],
                        download_name=original if wants_download else None,
                        display_name=original)


def _int_or_none(value):
    try:
        return int(value) if value not in (None, "") else None
    except (TypeError, ValueError):
        return None
