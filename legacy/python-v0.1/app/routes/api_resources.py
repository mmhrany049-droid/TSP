"""مسیرهای API ماژول ۱ — مرکز منابع (درس، کتاب، ساختار کتاب)."""
from __future__ import annotations

from ..server import Request, json_response, router
from ..services import resources
from .helpers import body, id_param


def register() -> None:
    # -- درس‌ها -------------------------------------------------------------
    @router.get("/api/subjects", )
    def list_subjects(request: Request):
        return json_response({
            "items": resources.list_subjects(
                request.db,
                include_archived=bool(request.q_bool("include_archived")),
                search=request.q("search")),
        })

    @router.post("/api/subjects")
    def create_subject(request: Request):
        return json_response(resources.create_subject(request.db, body(request)), 201)

    @router.get("/api/subjects/{id}")
    def get_subject(request: Request):
        return json_response(resources.get_subject(request.db, id_param(request)))

    @router.put("/api/subjects/{id}")
    def update_subject(request: Request):
        return json_response(resources.update_subject(request.db, id_param(request),
                                                      body(request)))

    @router.delete("/api/subjects/{id}")
    def delete_subject(request: Request):
        hard = bool(request.q_bool("hard"))
        return json_response(resources.delete_subject(request.db, id_param(request), hard))

    # -- کتاب‌ها -------------------------------------------------------------
    @router.get("/api/books")
    def list_books(request: Request):
        return json_response({"items": resources.list_books(
            request.db, subject_id=request.q_int("subject_id"),
            include_archived=bool(request.q_bool("include_archived")),
            search=request.q("search"))})

    @router.post("/api/books")
    def create_book(request: Request):
        return json_response(resources.create_book(request.db, body(request)), 201)

    @router.get("/api/books/{id}")
    def get_book(request: Request):
        return json_response(resources.get_book(request.db, id_param(request)))

    @router.put("/api/books/{id}")
    def update_book(request: Request):
        return json_response(resources.update_book(request.db, id_param(request),
                                                   body(request)))

    @router.delete("/api/books/{id}")
    def delete_book(request: Request):
        return json_response(resources.delete_book(request.db, id_param(request),
                                                   bool(request.q_bool("hard"))))

    @router.get("/api/books/{id}/tree")
    def book_tree(request: Request):
        return json_response(resources.get_node_tree(
            request.db, id_param(request),
            include_archived=bool(request.q_bool("include_archived"))))

    @router.get("/api/books/{id}/overview")
    def book_overview(request: Request):
        return json_response(resources.book_overview(request.db, id_param(request)))

    @router.post("/api/books/{id}/nodes")
    def create_node(request: Request):
        payload = body(request)
        payload.setdefault("book_id", id_param(request))
        return json_response(resources.create_node(request.db, payload), 201)

    @router.post("/api/books/{id}/nodes/reorder")
    def reorder_nodes(request: Request):
        payload = body(request)
        return json_response(resources.reorder_nodes(request.db, id_param(request),
                                                     payload.get("ordered_ids") or []))

    # -- گره‌های ساختاری -----------------------------------------------------
    @router.get("/api/nodes/{id}")
    def get_node(request: Request):
        node = resources._node_row(request.db, id_param(request))
        node["path"] = resources.node_path(request.db, node["id"])
        return json_response(node)

    @router.put("/api/nodes/{id}")
    def update_node(request: Request):
        return json_response(resources.update_node(request.db, id_param(request),
                                                   body(request)))

    @router.delete("/api/nodes/{id}")
    def delete_node(request: Request):
        return json_response(resources.delete_node(request.db, id_param(request),
                                                   bool(request.q_bool("hard"))))
