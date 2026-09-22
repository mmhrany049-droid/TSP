#!/usr/bin/env python3
"""اجرای برنامه TSP نسخه ۰.۱

    python3 run.py                 → http://127.0.0.1:8787
    python3 run.py --port 9000     → تغییر پورت
    python3 run.py --host 0.0.0.0  → دسترسی از شبکه

نیازی به نصب هیچ کتابخانه‌ای نیست؛ برنامه فقط با کتابخانه استاندارد پایتون اجرا می‌شود.
"""
from __future__ import annotations

import argparse
import sys
import webbrowser
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from app import config                      # noqa: E402
from app.db import Database                 # noqa: E402
from app.routes import register_all         # noqa: E402
from app.server import create_server        # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description="سرور برنامه TSP")
    parser.add_argument("--host", default="127.0.0.1",
                       help="آدرس اتصال (پیش‌فرض 127.0.0.1)")
    parser.add_argument("--port", type=int, default=8787, help="پورت سرور (پیش‌فرض 8787)")
    parser.add_argument("--db", default=str(config.DB_PATH), help="مسیر فایل پایگاه داده")
    parser.add_argument("--open", action="store_true", help="باز کردن مرورگر پس از اجرا")
    args = parser.parse_args()

    config.ensure_dirs()
    db = Database(Path(args.db))
    db.init_schema()
    register_all()
    server = create_server(db, host=args.host, port=args.port)
    url = f"http://{'127.0.0.1' if args.host in ('0.0.0.0', '') else args.host}:{args.port}/"
    print("─" * 62)
    print(f"  TSP نسخه {config.APP_VERSION} در حال اجراست")
    print(f"  آدرس        : {url}")
    print(f"  پایگاه داده : {args.db}")
    print("  برای توقف: Ctrl+C")
    print("─" * 62)
    if args.open:
        try:
            webbrowser.open(url)
        except Exception:
            pass
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nسرور متوقف شد.")
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
