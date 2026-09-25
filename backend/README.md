# راه‌اندازی Backend تی‌اس‌پی ۰.۳

نیازمندی: Python 3.11 یا جدیدتر.

```bash
cd backend
python -m venv .venv
# لینوکس / مک
source .venv/bin/activate
# ویندوز: .venv\\Scripts\\activate
pip install -r requirements.txt
cp .env.example .env
```

در محیط واقعی حتماً `SECRET_KEY` را به یک مقدار تصادفی و طولانی تغییر دهید. برای اجرا:

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

SQLite به‌صورت خودکار در `backend/tsp.db` ساخته می‌شود. برای مهاجرت‌ها:

```bash
alembic upgrade head
```

مستندات REST و OpenAPI در `http://localhost:8000/docs` و سلامت در `http://localhost:8000/api/v1/health` در دسترس است. پیشوند API برابر `/api/v1` است. مقدار `CORS_ORIGINS` را با آدرس Frontend هماهنگ کنید. فایل‌های پیوست آزمون در `UPLOAD_DIR` ذخیره می‌شوند.

ثبت‌نام و ورود JSON هستند؛ بعد از ورود، توکن را با هدر `Authorization: Bearer <access_token>` برای مسیرهای محافظت‌شده ارسال کنید. متن سؤال هیچ‌گاه در مدل بانک تست وجود ندارد. تلاش‌ها append-only هستند و سوابق پیشین در جدول مجزا نگهداری می‌شوند.
