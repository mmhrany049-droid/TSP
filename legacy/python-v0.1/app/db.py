"""لایه دسترسی به داده‌ها: اتصال، تراکنش، پرس‌وجو و ابزارهای کمکی.

طراحی بر پایه قاعده ۱۰ سند ۰۴: همه نوشتن‌ها در تراکنش‌های صریح انجام می‌شود و
هیچ داده عملکردی بازنویسی نمی‌شود؛ فقط درج رکورد جدید یا تغییر وضعیت/آرشیو.
"""
from __future__ import annotations

import json
import sqlite3
import threading
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable, Sequence

from . import config


def utc_now() -> str:
    """زمان کنونی به وقت UTC و در قالب ISO-8601 با پسوند Z."""
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def today_iso() -> str:
    return datetime.now(timezone.utc).date().isoformat()


class Database:
    """اتصال SQLite با پشتیبانی از چند رشته (هر رشته یک اتصال)."""

    def __init__(self, path: Path | str):
        self.path = Path(path)
        self._local = threading.local()
        # قفل بازگشتی: تراکنش‌های تودرتو در همان رشته مسدود نشوند
        self._lock = threading.RLock()

    # -- اتصال ---------------------------------------------------------------
    @property
    def conn(self) -> sqlite3.Connection:
        conn = getattr(self._local, "conn", None)
        if conn is None:
            self.path.parent.mkdir(parents=True, exist_ok=True)
            conn = sqlite3.connect(self.path, timeout=30.0, isolation_level=None)
            conn.row_factory = sqlite3.Row
            conn.execute("PRAGMA foreign_keys = ON")
            conn.execute("PRAGMA journal_mode = WAL")
            conn.execute("PRAGMA synchronous = NORMAL")
            self._local.conn = conn
        return conn

    @property
    def in_transaction(self) -> bool:
        return bool(getattr(self._local, "depth", 0))

    def close(self) -> None:
        conn = getattr(self._local, "conn", None)
        if conn is not None:
            conn.close()
            self._local.conn = None

    # -- ساخت طرح‌واره -------------------------------------------------------
    def init_schema(self) -> None:
        """ساخت جدول‌ها در صورت نبودن (اجرای مکرر بی‌خطر است)."""
        sql = config.SCHEMA_FILE.read_text(encoding="utf-8")
        conn = self.conn
        # executescript خودش تراکنش را مدیریت می‌کند و در حالت autocommit اجرا می‌شود
        conn.executescript(sql)
        conn.execute(
            "INSERT INTO app_meta(key, value) VALUES('schema_version', ?) "
            "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            (str(config.SCHEMA_VERSION),),
        )
        conn.execute(
            "INSERT INTO app_meta(key, value) VALUES('app_version', ?) "
            "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            (config.APP_VERSION,),
        )

    # -- تراکنش --------------------------------------------------------------
    @contextmanager
    def write(self):
        """تراکنش نوشتن؛ تودرتو بودن با savepoint پشتیبانی می‌شود.

        قفل فقط برای تراکنش بیرونی گرفته می‌شود تا فراخوانی تودرتو (مثلاً در ورود
        گروهی) باعث بن‌بست نشود و همه نوشتن‌ها در یک تراکنش انجام شوند.
        """
        conn = self.conn
        depth = getattr(self._local, "depth", 0)
        outer = depth == 0
        name = f"sp_{depth}"
        if outer:
            self._lock.acquire()
        try:
            if outer:
                conn.execute("BEGIN IMMEDIATE")
            else:
                conn.execute(f"SAVEPOINT {name}")
            self._local.depth = depth + 1
            try:
                yield conn.cursor()
            except Exception:
                if outer:
                    conn.execute("ROLLBACK")
                else:
                    conn.execute(f"ROLLBACK TO {name}")
                    conn.execute(f"RELEASE {name}")
                raise
            else:
                if outer:
                    conn.execute("COMMIT")
                else:
                    conn.execute(f"RELEASE {name}")
        finally:
            self._local.depth = depth
            if outer:
                self._lock.release()

    # -- پرس‌وجو -------------------------------------------------------------
    def query(self, sql: str, params: Sequence[Any] = ()) -> list[dict]:
        rows = self.conn.execute(sql, tuple(params)).fetchall()
        return [dict(row) for row in rows]

    def query_one(self, sql: str, params: Sequence[Any] = ()) -> dict | None:
        row = self.conn.execute(sql, tuple(params)).fetchone()
        return dict(row) if row is not None else None

    def scalar(self, sql: str, params: Sequence[Any] = (), default: Any = None) -> Any:
        row = self.conn.execute(sql, tuple(params)).fetchone()
        if row is None or row[0] is None:
            return default
        return row[0]

    def execute(self, sql: str, params: Sequence[Any] = ()) -> sqlite3.Cursor:
        """اجرای یک دستور نوشتن؛ اگر داخل تراکنش نباشیم خودش تراکنش می‌سازد."""
        if self.in_transaction:
            return self.conn.execute(sql, tuple(params))
        with self.write() as cur:
            return cur.execute(sql, tuple(params))

    def insert(self, table: str, values: dict) -> int:
        cols = ", ".join(values.keys())
        marks = ", ".join("?" for _ in values)
        cur = self.execute(
            f"INSERT INTO {table} ({cols}) VALUES ({marks})", tuple(values.values())
        )
        return int(cur.lastrowid)

    def update(self, table: str, row_id: int, values: dict, id_col: str = "id") -> None:
        if not values:
            return
        sets = ", ".join(f"{k} = ?" for k in values)
        self.execute(
            f"UPDATE {table} SET {sets} WHERE {id_col} = ?",
            tuple(values.values()) + (row_id,),
        )


# ---------------------------------------------------------------------------
# ابزارهای مشترک
# ---------------------------------------------------------------------------

def dumps(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False)


def loads(value: str | None, default: Any = None) -> Any:
    if value in (None, ""):
        return default
    try:
        return json.loads(value)
    except (json.JSONDecodeError, TypeError):
        return default


def placeholders(items: Iterable[Any]) -> str:
    items = list(items)
    return ", ".join("?" for _ in items)


def next_question_code(db: Database, prefix: str = "Q", width: int = 6) -> str:
    """تولید شناسه داخلی یکتا مانند Q-000184 (یکتایی واقعی تست)."""
    row = db.query_one(
        "SELECT code FROM question WHERE code LIKE ? "
        "ORDER BY LENGTH(code) DESC, code DESC LIMIT 1",
        (f"{prefix}-%",),
    )
    number = 1
    if row:
        tail = row["code"].split("-")[-1]
        if tail.isdigit():
            number = int(tail) + 1
    return f"{prefix}-{number:0{width}d}"


def code_exists(db: Database, code: str) -> bool:
    return bool(db.scalar("SELECT 1 FROM question WHERE code = ?", (code,)))
