"""مسیرهای API ماژول ۹ — آمادگی آزمون."""
from __future__ import annotations

from ..server import Request, json_response, router
from ..services import readiness
from .helpers import body, id_param


def register() -> None:
    @router.get("/api/plans")
    def list_plans(request: Request):
        return json_response({"items": readiness.list_plans(
            request.db, status=request.q("status"),
            upcoming_only=bool(request.q_bool("upcoming")))})

    @router.post("/api/plans")
    def create_plan(request: Request):
        return json_response(readiness.create_plan(request.db, body(request)), 201)

    @router.get("/api/plans/{id}")
    def get_plan(request: Request):
        return json_response(readiness.get_plan(request.db, id_param(request)))

    @router.put("/api/plans/{id}")
    def update_plan(request: Request):
        return json_response(readiness.update_plan(request.db, id_param(request),
                                                   body(request)))

    @router.put("/api/plans/{id}/topics")
    def set_topics(request: Request):
        return json_response(readiness.set_topics(request.db, id_param(request),
                                                  body(request).get("topics") or []))

    @router.post("/api/plans/{id}/evaluate")
    def evaluate(request: Request):
        payload = body(request)
        return json_response(readiness.evaluate(
            request.db, id_param(request),
            generate_items=payload.get("generate_review", True) is not False))

    @router.delete("/api/plans/{id}")
    def delete_plan(request: Request):
        return json_response(readiness.delete_plan(request.db, id_param(request)))

    @router.post("/api/readiness/analyze")
    def analyze(request: Request):
        payload = body(request)
        return json_response(readiness.analyze(
            request.db, [int(t) for t in (payload.get("topic_ids") or [])],
            exam_id=payload.get("exam_id"), exam_date=payload.get("exam_date")))

    @router.get("/api/readiness/upcoming")
    def upcoming(request: Request):
        return json_response({"items": readiness.upcoming_exams(
            request.db, days=request.q_int("days", 90) or 90)})
