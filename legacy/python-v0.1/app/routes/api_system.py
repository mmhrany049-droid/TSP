"""مسیرهای API سیستمی — فراداده، پشتیبان، ورود/صدور و داده نمونه."""
from __future__ import annotations

import json

from .. import config
from ..core import ApiError
from ..db import utc_now
from ..server import Request, Response, json_response, router
from ..services import importexport
from .helpers import body, page_args, uploaded_bytes


def register() -> None:
    @router.get("/api/health")
    def health(request: Request):
        return json_response({"status": "ok", "version": config.APP_VERSION,
                              "time": utc_now()})

    @router.get("/api/meta")
    def meta(request: Request):
        return json_response({
            "app_version": config.APP_VERSION,
            "schema_version": config.SCHEMA_VERSION,
            "labels": config.LABELS_FA,
            "enums": {
                "node_types": config.NODE_TYPES,
                "assessment_node_types": config.ASSESSMENT_NODE_TYPES,
                "results": config.RESULTS,
                "attempt_sources": config.ATTEMPT_SOURCES,
                "taught_statuses": config.TAUGHT_STATUSES,
                "topic_statuses": config.TOPIC_STATUSES,
                "topic_relation_types": config.TOPIC_RELATION_TYPES,
                "exam_types": config.EXAM_TYPES,
                "exam_states": config.EXAM_STATES,
                "review_reasons": config.REVIEW_REASONS,
                "review_states": config.REVIEW_STATES,
                "analytics_levels": config.ANALYTICS_LEVELS,
            },
            "sample_available": importexport.sample_available(request.db),
        })

    # -- داده نمونه ---------------------------------------------------------
    @router.get("/api/sample/status")
    def sample_status(request: Request):
        return json_response({"available": importexport.sample_available(request.db)})

    @router.post("/api/sample/load")
    def load_sample(request: Request):
        return json_response(importexport.load_sample(request.db), 201)

    # -- صدور / ورود --------------------------------------------------------
    @router.get("/api/export")
    def export_all(request: Request):
        include_activity = bool(request.q_bool("include_activity"))
        payload = importexport.export_all(request.db, include_activity=include_activity)
        if request.q("download"):
            name = f"tsp-export-{utc_now()[:10]}.json"
            return Response(
                raw=json.dumps(payload, ensure_ascii=False, indent=1).encode("utf-8"),
                content_type="application/json; charset=utf-8",
                download_name=name)
        return json_response(payload)

    @router.post("/api/import")
    def import_all(request: Request):
        payload = body(request)
        package = payload.get("package") or payload
        return json_response(importexport.import_all(
            request.db, package, mode=payload.get("mode") or "merge",
            validate_only=bool(payload.get("validate_only"))))

    @router.post("/api/import/file")
    def import_file(request: Request):
        data, filename, _ = uploaded_bytes(request)
        try:
            package = json.loads(data.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            raise ApiError("فایل ارسالی JSON معتبر نیست", 422, {"file": "نامعتبر"})
        mode = request.body.get("mode") or "merge"
        return json_response(importexport.import_all(request.db, package, mode=mode))

    # -- پشتیبان‌گیری --------------------------------------------------------
    @router.post("/api/backup")
    def backup(request: Request):
        result = importexport.backup_database(request.db)
        if request.q_bool("download"):
            return Response(file_path=result["path"],
                            download_name=result["file"].split("/")[-1])
        return json_response(result, 201)

    @router.get("/api/backups")
    def backups(request: Request):
        return json_response({"items": importexport.list_backups(request.db)})

    # -- CSV ----------------------------------------------------------------
    @router.get("/api/csv/template")
    def csv_template(request: Request):
        content = importexport.csv_template()
        return Response(raw=("\ufeff" + content).encode("utf-8"),
                        content_type="text/csv; charset=utf-8",
                        download_name="tsp-questions-template.csv")

    @router.post("/api/csv/questions")
    def import_csv(request: Request):
        data, filename, _ = uploaded_bytes(request)
        text = data.decode("utf-8-sig", "replace")
        body_data = request.body if isinstance(request.body, dict) else {}
        book_id = body_data.get("book_id") or request.q("book_id")
        dry_run = body_data.get("dry_run") or request.q("dry_run") or ""
        result = importexport.import_questions_csv(
            request.db, text, book_id=int(book_id) if book_id else None,
            dry_run=str(dry_run).lower() in ("1", "true", "yes", "on"))
        return json_response(result, 201)


def _unused_page_args():
    return page_args
