"""مسیرهای API ماژول ۲ — ساختار مباحث آموزشی."""
from __future__ import annotations

from ..server import Request, json_response, router
from ..services import topics
from .helpers import body, id_param


def register() -> None:
    @router.get("/api/topics")
    def list_topics(request: Request):
        return json_response({"items": topics.list_topics(
            request.db, subject_id=request.q_int("subject_id"),
            include_archived=bool(request.q_bool("include_archived")),
            search=request.q("search"), status=request.q("status"))})

    @router.get("/api/topics/tree")
    def topic_tree(request: Request):
        return json_response({"items": topics.get_topic_tree(
            request.db, subject_id=request.q_int("subject_id"),
            include_archived=bool(request.q_bool("include_archived")))})

    @router.post("/api/topics")
    def create_topic(request: Request):
        return json_response(topics.create_topic(request.db, body(request)), 201)

    @router.get("/api/topics/{id}")
    def get_topic(request: Request):
        topic = topics.get_topic(request.db, id_param(request))
        topic["stats"] = topics.topic_stats(request.db, topic["id"])
        return json_response(topic)

    @router.put("/api/topics/{id}")
    def update_topic(request: Request):
        return json_response(topics.update_topic(request.db, id_param(request),
                                                 body(request)))

    @router.delete("/api/topics/{id}")
    def delete_topic(request: Request):
        return json_response(topics.delete_topic(request.db, id_param(request),
                                                 bool(request.q_bool("hard"))))

    @router.get("/api/topics/{id}/stats")
    def topic_stats(request: Request):
        return json_response(topics.topic_stats(
            request.db, id_param(request),
            include_subtopics=request.q_bool("include_subtopics", True) is not False))

    @router.get("/api/topics/{id}/questions")
    def topic_questions(request: Request):
        return json_response({"items": topics.topic_questions(
            request.db, id_param(request),
            include_subtopics=request.q_bool("include_subtopics", True) is not False)})

    @router.post("/api/topics/{id}/questions")
    def attach_questions(request: Request):
        payload = body(request)
        return json_response(topics.attach_questions(
            request.db, id_param(request),
            [int(q) for q in (payload.get("question_ids") or [])],
            payload.get("relation_type") or "primary"), 201)

    @router.delete("/api/topics/{id}/questions/{question_id}")
    def detach_question(request: Request):
        question_id = int(request.params["question_id"])
        return json_response(topics.detach_question(request.db, id_param(request), question_id))
