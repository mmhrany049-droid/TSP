"""سرور وب TSP — فقط با کتابخانه استاندارد پایتون.

اجرا:  python3 run.py      →  http://127.0.0.1:8787
"""
from __future__ import annotations

import json
import mimetypes
import re
import sys
import traceback
from dataclasses import dataclass, field
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, quote, unquote, urlparse

from . import config
from .core import ApiError
from .db import Database

API_PREFIX = "/api"


# ---------------------------------------------------------------------------
# درخواست و پاسخ
# ---------------------------------------------------------------------------

@dataclass
class UploadedFile:
    field_name: str
    filename: str
    content_type: str
    data: bytes


@dataclass
class Request:
    method: str
    path: str
    query: dict[str, str] = field(default_factory=dict)
    query_all: dict[str, list[str]] = field(default_factory=dict)
    headers: dict[str, str] = field(default_factory=dict)
    params: dict[str, str] = field(default_factory=dict)
    body: dict = field(default_factory=dict)
    files: list[UploadedFile] = field(default_factory=list)
    db: Database | None = None

    def q(self, name: str, default=None):
        return self.query.get(name, default)

    def q_int(self, name: str, default: int | None = None) -> int | None:
        value = self.query.get(name)
        if value in (None, ""):
            return default
        try:
            return int(value)
        except ValueError:
            raise ApiError(f"پارامتر {name} باید عدد باشد", 422, {name: "عدد نامعتبر"})

    def q_bool(self, name: str, default: bool | None = None) -> bool | None:
        value = self.query.get(name)
        if value in (None, ""):
            return default
        return str(value).lower() in ("1", "true", "yes", "on")

    def q_list(self, name: str) -> list[str]:
        raw = self.query_all.get(name) or []
        items: list[str] = []
        for value in raw:
            items.extend(part for part in re.split(r"[,;]", value) if part.strip())
        return [item.strip() for item in items if item.strip()]

    def data(self) -> dict:
        return self.body if isinstance(self.body, dict) else {}


@dataclass
class Response:
    status: int = 200
    payload: object | None = None
    raw: bytes | None = None
    content_type: str = "application/json; charset=utf-8"
    headers: dict[str, str] = field(default_factory=dict)
    file_path: Path | None = None
    download_name: str | None = None      # اگر مقدار داشته باشد، فایل «دانلود» می‌شود
    display_name: str | None = None       # نام نمایشی دلخواه (فارسی) برای فایل‌های درون‌خطی


def json_response(payload, status: int = 200) -> Response:
    return Response(status=status, payload=payload)


# ---------------------------------------------------------------------------
# مسیریاب
# ---------------------------------------------------------------------------

class Router:
    def __init__(self):
        self.routes: list[tuple[str, re.Pattern, callable]] = []

    def add(self, method: str, pattern: str, handler):
        regex = re.compile("^" + re.sub(r"\{(\w+)\}", r"(?P<\1>[^/]+)", pattern) + "$")
        self.routes.append((method.upper(), regex, handler))

    # امکان استفاده هم به‌صورت decorator و هم فراخوانی مستقیم
    def get(self, pattern, handler=None):
        return self._register("GET", pattern, handler)

    def post(self, pattern, handler=None):
        return self._register("POST", pattern, handler)

    def put(self, pattern, handler=None):
        return self._register("PUT", pattern, handler)

    def patch(self, pattern, handler=None):
        return self._register("PATCH", pattern, handler)

    def delete(self, pattern, handler=None):
        return self._register("DELETE", pattern, handler)

    def _register(self, method: str, pattern: str, handler=None):
        if handler is None:
            def decorator(function):
                self.add(method, pattern, function)
                return function
            return decorator
        self.add(method, pattern, handler)
        return handler

    def match(self, method: str, path: str):
        for route_method, regex, handler in self.routes:
            found = regex.match(path)
            if found:
                if route_method == method:
                    return handler, found.groupdict()
                if route_method == "GET" and method == "HEAD":
                    return handler, found.groupdict()
        return None, None


router = Router()


# ---------------------------------------------------------------------------
# ابزارهای کمکی پاسخ
# ---------------------------------------------------------------------------

def _json_default(value):
    if isinstance(value, Path):
        return str(value)
    return str(value)


class Handler(BaseHTTPRequestHandler):
    server_version = f"TSP/{config.APP_VERSION}"
    protocol_version = "HTTP/1.1"
    db: Database = None  # در create_server مقدار می‌گیرد

    # -- ابزار --------------------------------------------------------------
    def log_message(self, fmt, *args):  # noqa: A003
        sys.stderr.write("[TSP] %s - %s\n" % (self.address_string(), fmt % args))

    def _send(self, response: Response) -> None:
        body: bytes
        if response.file_path is not None:
            path = Path(response.file_path)
            if not path.exists():
                self._send(Response(status=404, payload={"error": "فایل یافت نشد"}))
                return
            data = path.read_bytes()
            content_type = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
            self.send_response(response.status)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(data)))
            disposition = "attachment" if response.download_name else "inline"
            name = response.download_name or response.display_name or path.name
            # نام فایل فارسی: هدر HTTP باید ASCII باشد، پس نام UTF-8 جداگانه (RFC 5987)
            # فرستاده می‌شود و نسخه ASCII فقط برای مرورگرهای قدیمی است.
            extension = name.rsplit(".", 1)[-1] if "." in name else ""
            ascii_stem = re.sub(r"[^A-Za-z0-9_-]+", "-", name.rsplit(".", 1)[0]).strip("-")
            if not ascii_stem:
                ascii_stem = "file"
            ascii_name = (f"{ascii_stem}.{extension}"
                          if extension and extension.isascii() and extension.isalnum()
                          else ascii_stem)
            encoded = quote(name, safe="")
            self.send_header("Content-Disposition",
                             f'{disposition}; filename="{ascii_name}"; '
                             f"filename*=UTF-8''{encoded}")
            for key, value in response.headers.items():
                self.send_header(key, value)
            self.end_headers()
            if self.command != "HEAD":
                self.wfile.write(data)
            return
        if response.raw is not None:
            body = response.raw
        else:
            body = json.dumps(response.payload, ensure_ascii=False,
                              default=_json_default).encode("utf-8")
        self.send_response(response.status)
        self.send_header("Content-Type", response.content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        for key, value in response.headers.items():
            self.send_header(key, value)
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def _read_body(self) -> bytes:
        length = int(self.headers.get("Content-Length") or 0)
        if length <= 0:
            return b""
        if length > config.MAX_UPLOAD_BODY:
            raise ApiError("حجم درخواست بیش از حد مجاز است", 413)
        remaining = length
        chunks = []
        while remaining > 0:
            chunk = self.rfile.read(min(remaining, 1024 * 256))
            if not chunk:
                break
            chunks.append(chunk)
            remaining -= len(chunk)
        return b"".join(chunks)

    def _parse_multipart(self, raw: bytes, boundary: str) -> tuple[dict, list[UploadedFile]]:
        fields: dict[str, str] = {}
        files: list[UploadedFile] = []
        marker = b"--" + boundary.encode("utf-8")
        parts = raw.split(marker)
        for part in parts[1:]:
            if part[:2] == b"--":
                break
            part = part.lstrip(b"\r\n")
            if b"\r\n\r\n" not in part:
                continue
            header_blob, content = part.split(b"\r\n\r\n", 1)
            content = content.rstrip(b"\r\n")
            headers: dict[str, str] = {}
            for line in header_blob.decode("utf-8", "replace").split("\r\n"):
                if ":" in line:
                    key, value = line.split(":", 1)
                    headers[key.strip().lower()] = value.strip()
            disposition = headers.get("content-disposition", "")
            name_match = re.search(r'name="([^"]*)"', disposition)
            file_match = re.search(r'filename="([^"]*)"', disposition)
            field_name = name_match.group(1) if name_match else ""
            if file_match:
                files.append(UploadedFile(
                    field_name=field_name,
                    filename=unquote(file_match.group(1)),
                    content_type=headers.get("content-type", "application/octet-stream"),
                    data=content,
                ))
            else:
                fields[field_name] = content.decode("utf-8", "replace")
        return fields, files

    def _handle(self, method: str) -> None:
        parsed = urlparse(self.path)
        path = unquote(parsed.path)
        try:
            if path.startswith(API_PREFIX):
                self._handle_api(method, path, parsed.query)
            else:
                self._handle_static(path)
        except ApiError as exc:
            self._send(Response(status=exc.status, payload=exc.to_dict()))
        except BrokenPipeError:
            pass
        except Exception:  # noqa: BLE001
            traceback.print_exc()
            self._send(Response(status=500, payload={
                "error": "خطای داخلی سرور رخ داد", "detail": traceback.format_exc(limit=3)}))

    def _handle_api(self, method: str, path: str, query_string: str) -> None:
        handler, params = router.match(method, path)
        if handler is None:
            raise ApiError(f"مسیر یافت نشد: {method} {path}", 404)
        request = Request(
            method=method, path=path, headers=dict(self.headers), params=params or {},
            db=self.db,
        )
        parsed_query = parse_qs(query_string, keep_blank_values=False)
        request.query_all = parsed_query
        request.query = {key: values[-1] for key, values in parsed_query.items()}
        raw = self._read_body()
        content_type = self.headers.get("Content-Type") or ""
        if raw:
            if "application/json" in content_type:
                try:
                    request.body = json.loads(raw.decode("utf-8"))
                except json.JSONDecodeError:
                    raise ApiError("بدنه JSON نامعتبر است", 400)
            elif "multipart/form-data" in content_type:
                match = re.search(r"boundary=([^;]+)", content_type)
                if not match:
                    raise ApiError("مرز (boundary) فایل ارسالی مشخص نیست", 400)
                fields, files = self._parse_multipart(raw, match.group(1).strip('"'))
                request.body = fields
                request.files = files
            elif "application/x-www-form-urlencoded" in content_type:
                request.body = {key: values[-1]
                                for key, values in parse_qs(raw.decode("utf-8")).items()}
            elif "text/csv" in content_type or "text/plain" in content_type:
                request.body = {"text": raw.decode("utf-8", "replace")}
            else:
                request.body = {"raw": raw}
        response = handler(request)
        if response is None:
            response = Response(payload={"ok": True})
        if not isinstance(response, Response):
            response = Response(payload=response)
        self._send(response)

    # -- فایل‌های ایستا ------------------------------------------------------
    def _handle_static(self, path: str) -> None:
        relative = path.lstrip("/") or "index.html"
        candidate = (config.STATIC_DIR / relative).resolve()
        try:
            candidate.relative_to(config.STATIC_DIR.resolve())
        except ValueError:
            raise ApiError("مسیر نامعتبر", 400)
        if not candidate.exists() or candidate.is_dir():
            candidate = config.STATIC_DIR / "index.html"
        if not candidate.exists():
            raise ApiError("فایل یافت نشد", 404)
        content_type = mimetypes.guess_type(candidate.name)[0] or "application/octet-stream"
        if content_type.startswith("text/") or content_type in (
                "application/javascript", "application/json"):
            content_type += "; charset=utf-8"
        data = candidate.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(data)

    # -- متدهای HTTP --------------------------------------------------------
    def do_GET(self):      # noqa: N802
        self._handle("GET")

    def do_HEAD(self):     # noqa: N802
        self._handle("HEAD")

    def do_POST(self):     # noqa: N802
        self._handle("POST")

    def do_PUT(self):      # noqa: N802
        self._handle("PUT")

    def do_PATCH(self):    # noqa: N802
        self._handle("PATCH")

    def do_DELETE(self):   # noqa: N802
        self._handle("DELETE")


def create_server(db: Database, host: str = "0.0.0.0", port: int = 8787):
    config.ensure_dirs()
    handler = type("TSPHandler", (Handler,), {"db": db})
    return ThreadingHTTPServer((host, port), handler)
