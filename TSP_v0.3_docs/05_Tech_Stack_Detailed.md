# پشته فناوری نسخه ۰.۳ — با توضیح کامل

## Backend (Python)

| جزء | انتخاب | دلیل |
|-----|--------|------|
| فریمورک | **FastAPI** | سریع، مدرن، مستندات خودکار، پشتیبانی عالی از async و Pydantic |
| ORM | **SQLAlchemy 2.0** | استاندارد صنعتی پایتون، قدرتمند |
| اعتبارسنجی | **Pydantic v2** | هماهنگی کامل با FastAPI |
| دیتابیس توسعه | **SQLite** | بدون نیاز به نصب سرور، مناسب اپ شخصی |
| دیتابیس آینده | PostgreSQL | قابل ارتقا بدون تغییر زیاد کد |
| مهاجرت | **Alembic** | همراه همیشگی SQLAlchemy |
| احراز هویت | **python-jose + passlib + bcrypt** | JWT + هش امن رمز |
| سرور توسعه | **Uvicorn** | ASGI استاندارد |

### فایل requirements.txt پیشنهادی

```
fastapi>=0.115.0
uvicorn[standard]>=0.32.0
sqlalchemy>=2.0.36
alembic>=1.14.0
pydantic>=2.10.0
pydantic-settings>=2.6.0
python-jose[cryptography]>=3.3.0
passlib[bcrypt]>=1.7.4
python-multipart>=0.0.12
python-dotenv>=1.0.1
```

---

## Frontend (Node.js)

| جزء | انتخاب | دلیل |
|-----|--------|------|
| فریمورک | **Next.js 15 (App Router)** | قدرتمند، SSR/SSG، ساختار مدرن |
| زبان | **TypeScript** | کاهش باگ |
| استایل | **Tailwind CSS 4** | سریع + پشتیبانی عالی RTL |
| کامپوننت | کامپوننت‌های تمیز Tailwind یا shadcn/ui | زیبایی و سرعت |
| درخواست HTTP | **fetch بومی** یا ky/axios | سادگی |
| مدیریت توکن | httpOnly cookie یا memory + context | امنیت |
| آیکون | Lucide React | سبک و زیبا |
| فونت | وزیرمتن (محلی یا CDN) | فارسی استاندارد |

---

## ابزارهای مشترک

- Git برای نسخه‌بندی
- ESLint + Prettier در Frontend
- Ruff یا Black + isort در Backend
- فایل `.env` جدا برای هر لایه

---

## پورت‌های پیش‌فرض

| سرویس | پورت |
|-------|------|
| Frontend (Next.js) | 3000 |
| Backend (FastAPI) | 8000 |

Frontend باید آدرس Backend را از متغیر محیطی بخواند:
```
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
```
