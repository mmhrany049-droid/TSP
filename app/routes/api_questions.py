"""مسیرهای API ماژول ۳ و ۴ — بانک تست و ثبت سابقه."""
from __future__ import annotations

from ..core import ApiError, as_int
from ..server import Request, json_response, router
from ..services import attempts, questions
from .helpers import body, id_param, page_args


def register() -> None:
    # -- بانک تست -----------------------------------------------------------
    @router.get("/api/questions")
    def list_questions(request: Request):
        paging = page_args(request)
        return json_response(questions.list_questions(
            request.db,
            subject_id=request.q_int("subject_id"),
            book_id=request.q_int("book_id"),
            book_node_id=request.q_int("book_node_id"),
            include_subnodes=request.q_bool("include_subnodes", True) is not False,
            topic_id=request.q_int("topic_id"),
            include_subtopics=request.q_bool("include_subtopics", True) is not False,
            result=request.q("result"),
            attempt_state=request.q("attempt_state"),
            important=_bool_or_none(request, "important"),
            hard=_bool_or_none(request, "hard"),
            has_key=_bool_or_none(request, "has_key"),
            untried_only=bool(request.q_bool("untried")),
            search=request.q("search"),
            state=request.q("state") or "active",
            sort=request.q("sort") or "code",
            order=request.q("order") or "asc",
            **paging))

    @router.get("/api/questions/summary")
    def questions_summary(request: Request):
        return json_response(questions.question_summary_counts(
            request.db, subject_id=request.q_int("subject_id")))

    @router.post("/api/questions")
    def create_question(request: Request):
        return json_response(questions.create_question(request.db, body(request)), 201)

    @router.post("/api/questions/bulk")
    def bulk_create(request: Request):
        payload = body(request)
        rows = payload.get("questions") or payload.get("items") or []
        if not isinstance(rows, list):
            raise ApiError("questions باید فهرست باشد", 422, {"questions": "نامعتبر"})
        return json_response(questions.bulk_create_questions(
            request.db, rows, relation_type=payload.get("relation_type") or "primary",
            stop_on_error=bool(payload.get("stop_on_error"))), 201)

    @router.post("/api/questions/import-structure")
    def import_structure(request: Request):
        return json_response(questions.import_questions_json(request.db, body(request)), 201)

    @router.get("/api/questions/{id}")
    def get_question(request: Request):
        return json_response(questions.get_question(request.db, id_param(request)))

    @router.put("/api/questions/{id}")
    def update_question(request: Request):
        return json_response(questions.update_question(request.db, id_param(request),
                                                       body(request)))

    @router.delete("/api/questions/{id}")
    def archive_question(request: Request):
        return json_response(questions.archive_question(request.db, id_param(request)))

    @router.post("/api/questions/{id}/restore")
    def restore_question(request: Request):
        return json_response(questions.restore_question(request.db, id_param(request)))

    @router.put("/api/questions/{id}/flags")
    def set_flags(request: Request):
        payload = body(request)
        return json_response(questions.set_flags(
            request.db, id_param(request),
            important=payload.get("important"), hard=payload.get("hard")))

    @router.put("/api/questions/{id}/topics")
    def set_topics(request: Request):
        return json_response(questions.set_topics(request.db, id_param(request),
                                                  body(request).get("topics") or []))

    # -- سابقه و تلاش‌ها -----------------------------------------------------
    @router.get("/api/attempts")
    def list_attempts(request: Request):
        paging = page_args(request)
        items = attempts.list_attempts(
            request.db, request.q_int("question_id"),
            subject_id=request.q_int("subject_id"), book_id=request.q_int("book_id"),
            result=request.q("result"), source=request.q("source"),
            date_from=request.q("date_from"), date_to=request.q("date_to"),
            include_voided=bool(request.q_bool("include_voided")),
            search=request.q("search"), **paging)
        return json_response({"items": items, **paging})

    @router.post("/api/attempts")
    def create_attempt(request: Request):
        return json_response(attempts.record_attempt(request.db, body(request)), 201)

    @router.post("/api/attempts/bulk")
    def bulk_attempts(request: Request):
        payload = body(request)
        return json_response(attempts.record_many_attempts(
            request.db, payload.get("attempts") or [], default_when=payload.get("attempted_at"),
            source=payload.get("source") or "app"), 201)

    @router.get("/api/attempts/{id}")
    def get_attempt(request: Request):
        return json_response(attempts.get_attempt(request.db, id_param(request)))

    @router.patch("/api/attempts/{id}")
    def update_attempt(request: Request):
        payload = body(request)
        return json_response(attempts.update_attempt_note(request.db, id_param(request),
                                                          payload.get("notes")))

    @router.post("/api/attempts/{id}/void")
    def void_attempt(request: Request):
        return json_response(attempts.void_attempt(request.db, id_param(request),
                                                   body(request).get("reason")))

    @router.post("/api/attempts/{id}/restore")
    def restore_attempt(request: Request):
        return json_response(attempts.restore_attempt(request.db, id_param(request)))

    # -- سابقه تست‌های قبلاً حل‌شده ------------------------------------------
    @router.get("/api/previous-entries")
    def list_previous(request: Request):
        paging = page_args(request)
        return json_response({"items": attempts.list_previous_entries(
            request.db, request.q_int("question_id"), result=request.q("result"),
            batch_id=request.q_int("batch_id"),
            include_voided=bool(request.q_bool("include_voided")), **paging), **paging})

    @router.post("/api/previous-entries")
    def create_previous(request: Request):
        payload = body(request)
        entries = payload.get("entries") or []
        if not isinstance(entries, list) or not entries:
            raise ApiError("فهرست entries خالی است", 422, {"entries": "الزامی"})
        return json_response(attempts.record_previous_entries(
            request.db, entries, import_label=payload.get("label"),
            note=payload.get("note"),
            auto_review=payload.get("auto_review", True) is not False), 201)

    @router.post("/api/previous-entries/{id}/void")
    def void_previous(request: Request):
        return json_response(attempts.void_previous_entry(request.db, id_param(request),
                                                          body(request).get("reason")))

    @router.get("/api/batches")
    def batches(request: Request):
        return json_response({"items": attempts.list_batches(
            request.db, kind=request.q("kind"),
            limit=request.q_int("limit", 50) or 50)})


def _bool_or_none(request: Request, name: str) -> bool | None:
    return request.q_bool(name)
