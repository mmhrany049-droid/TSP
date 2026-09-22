"""مسیرهای API ماژول ۵ — مرور هوشمند."""
from __future__ import annotations

from ..server import Request, json_response, router
from ..services import review
from .helpers import body, id_param, page_args


def register() -> None:
    @router.get("/api/reviews")
    def list_items(request: Request):
        paging = page_args(request)
        return json_response(review.list_items(
            request.db, reasons=request.q_list("reasons") or None,
            state=request.q("state") or "open", level=request.q("level"),
            subject_id=request.q_int("subject_id"), book_id=request.q_int("book_id"),
            topic_id=request.q_int("topic_id"), book_node_id=request.q_int("book_node_id"),
            min_priority=request.q_int("min_priority"),
            search=request.q("search"),
            sync=request.q_bool("sync", True) is not False, **paging))

    @router.get("/api/reviews/summary")
    def review_summary(request: Request):
        return json_response(review.review_summary(
            request.db, sync=request.q_bool("sync", True) is not False))

    @router.get("/api/reviews/filters")
    def filters(request: Request):
        return json_response({"filters": review.LIVE_FILTERS,
                              "question_reasons": review.QUESTION_REASONS,
                              "topic_reasons": review.TOPIC_REASONS,
                              "weights": review.REASON_WEIGHTS})

    @router.post("/api/reviews/filter-search")
    def filter_search(request: Request):
        payload = body(request)
        return json_response(review.filtered_questions(
            request.db, payload.get("filters") or [],
            match_all=bool(payload.get("match_all")),
            subject_id=payload.get("subject_id"), book_id=payload.get("book_id"),
            topic_id=payload.get("topic_id"), book_node_id=payload.get("book_node_id"),
            limit=int(payload.get("limit") or 200), offset=int(payload.get("offset") or 0)))

    @router.get("/api/reviews/batch")
    def study_batch(request: Request):
        return json_response(review.study_batch(
            request.db, request.q_list("filters") or None,
            limit=request.q_int("limit", 20) or 20,
            subject_id=request.q_int("subject_id"), book_id=request.q_int("book_id"),
            topic_id=request.q_int("topic_id")))

    @router.post("/api/reviews")
    def add_item(request: Request):
        return json_response(review.add_item(request.db, body(request)), 201)

    @router.get("/api/reviews/{id}")
    def get_item(request: Request):
        return json_response(review.get_item(request.db, id_param(request)))

    @router.patch("/api/reviews/{id}")
    def update_item(request: Request):
        return json_response(review.update_item(request.db, id_param(request), body(request)))

    @router.delete("/api/reviews/{id}")
    def archive_item(request: Request):
        return json_response(review.update_item(request.db, id_param(request),
                                                {"state": "archived"}))

    @router.post("/api/reviews/{id}/remove-reason")
    def remove_reason(request: Request):
        payload = body(request)
        return json_response(review.remove_reason(request.db, id_param(request),
                                                  payload.get("reason")))

    @router.post("/api/reviews/sync")
    def sync(request: Request):
        return json_response(review.sync_all(request.db))
