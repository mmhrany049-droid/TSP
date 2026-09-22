"""مسیرهای API ماژول ۱۰ و ۱۱ — تحلیل، آمار و داشبورد."""
from __future__ import annotations

from ..server import Request, json_response, router
from ..services import analytics, importexport
from .helpers import id_param


def register() -> None:
    @router.get("/api/dashboard")
    def dashboard(request: Request):
        return json_response(analytics.dashboard(request.db,
                                                 subject_id=request.q_int("subject_id")))

    @router.get("/api/analytics/headline")
    def headline(request: Request):
        return json_response(analytics.headline(request.db))

    @router.get("/api/analytics/performance")
    def performance(request: Request):
        return json_response(analytics.performance(
            request.db, request.q("level") or "overall",
            subject_id=request.q_int("subject_id"), book_id=request.q_int("book_id"),
            book_node_id=request.q_int("book_node_id"), topic_id=request.q_int("topic_id"),
            days=request.q_int("days"),
            limit=request.q_int("limit", 200) or 200))

    @router.get("/api/analytics/timeseries")
    def timeseries(request: Request):
        return json_response(analytics.timeseries(
            request.db, unit=request.q("unit") or "day",
            window=request.q_int("window", 30) or 30,
            subject_id=request.q_int("subject_id"), book_id=request.q_int("book_id"),
            topic_id=request.q_int("topic_id")))

    @router.get("/api/analytics/leaderboard")
    def leaderboard(request: Request):
        return json_response(analytics.topic_leaderboard(
            request.db, subject_id=request.q_int("subject_id"),
            limit=request.q_int("limit", 10) or 10,
            min_attempts=request.q_int("min_attempts", 5) or 5))

    @router.get("/api/analytics/activity")
    def activity(request: Request):
        return json_response({"items": analytics.activity_feed(
            request.db, limit=request.q_int("limit", 30) or 30)})

    @router.get("/api/analytics/trend")
    def trend(request: Request):
        return json_response(analytics.compare_windows(
            request.db, days=request.q_int("days", 7) or 7))

    @router.get("/api/analytics/streak")
    def streak(request: Request):
        return json_response(analytics.streak(request.db))

    @router.get("/api/analytics/exams")
    def exam_metrics(request: Request):
        return json_response(analytics.exam_metrics(request.db,
                                                    subject_id=request.q_int("subject_id")))

    @router.get("/api/integrity")
    def integrity(request: Request):
        return json_response(importexport.validate_all(request.db))
