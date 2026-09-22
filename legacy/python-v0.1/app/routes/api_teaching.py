"""مسیرهای API ماژول ۶ — تدریس و عقب‌ماندگی."""
from __future__ import annotations

from ..server import Request, json_response, router
from ..services import teaching
from .helpers import body, id_param


def register() -> None:
    @router.get("/api/teaching/units")
    def list_units(request: Request):
        return json_response({"items": teaching.list_teaching_units(
            request.db, subject_id=request.q_int("subject_id"), status=request.q("status"))})

    @router.get("/api/teaching/overview")
    def overview(request: Request):
        data = teaching.overview(request.db, subject_id=request.q_int("subject_id"))
        data.pop("units", None)
        return json_response(data)

    @router.put("/api/teaching/units/{topic_id}")
    def set_status(request: Request):
        return json_response(teaching.set_teaching_status(
            request.db, int(request.params["topic_id"]), body(request)))

    @router.get("/api/teaching/units/{topic_id}")
    def get_unit(request: Request):
        return json_response(teaching.get_teaching_unit(
            request.db, int(request.params["topic_id"])))

    @router.get("/api/teaching/goals")
    def list_goals(request: Request):
        return json_response({"items": teaching.list_goals(
            request.db, topic_id=request.q_int("topic_id"),
            subject_id=request.q_int("subject_id"),
            status=request.q("status") or "active")})

    @router.post("/api/teaching/goals")
    def create_goal(request: Request):
        return json_response(teaching.create_goal(request.db, body(request)), 201)

    @router.get("/api/teaching/goals/{id}")
    def get_goal(request: Request):
        return json_response(teaching.get_goal(request.db, id_param(request)))

    @router.put("/api/teaching/goals/{id}")
    def update_goal(request: Request):
        return json_response(teaching.update_goal(request.db, id_param(request),
                                                  body(request)))

    @router.delete("/api/teaching/goals/{id}")
    def delete_goal(request: Request):
        return json_response(teaching.delete_goal(request.db, id_param(request)))
