# معماری نسخه ۰.۳ — TSP

## ۱. نمای کلی معماری

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend                              │
│              Next.js 15 + TypeScript + Tailwind              │
│                     (پورت 3000)                              │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTP / JSON (REST API)
                           │ Authorization: Bearer <JWT>
┌──────────────────────────▼──────────────────────────────────┐
│                        Backend                               │
│              FastAPI + SQLAlchemy + Pydantic                 │
│                     (پورت 8000)                              │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                     Database                                 │
│              SQLite (شروع) / PostgreSQL (آینده)              │
└─────────────────────────────────────────────────────────────┘
```

### اصول معماری

- Backend و Frontend **کاملاً جدا** هستند.
- Frontend هرگز مستقیم به دیتابیس وصل نمی‌شود.
- تمام منطق کسب‌وکار در Backend است.
- Frontend فقط مسئول نمایش و جمع‌آوری ورودی کاربر است.
- ارتباط فقط از طریق REST API با فرمت JSON انجام می‌شود.
- احراز هویت با JWT انجام می‌شود.

---

## ۲. ساختار پیشنهادی پوشه‌ها

### Backend (پایتون)

```
backend/
├── app/
│   ├── main.py                 # نقطه ورود FastAPI
│   ├── config.py               # تنظیمات
│   ├── database.py             # اتصال دیتابیس
│   ├── models/                 # مدل‌های SQLAlchemy
│   │   ├── __init__.py
│   │   ├── user.py
│   │   ├── book.py
│   │   ├── question.py
│   │   ├── attempt.py
│   │   ├── topic.py
│   │   ├── teaching.py
│   │   ├── exam.py
│   │   └── review.py
│   ├── schemas/                # Pydantic schemas
│   ├── api/                    # روترها
│   │   ├── auth.py
│   │   ├── books.py
│   │   ├── questions.py
│   │   ├── attempts.py
│   │   ├── topics.py
│   │   ├── teaching.py
│   │   ├── exams.py
│   │   ├── review.py
│   │   ├── readiness.py
│   │   └── dashboard.py
│   ├── services/               # منطق کسب‌وکار
│   ├── core/                   # امنیت، وابستگی‌ها
│   │   ├── security.py
│   │   └── deps.py
│   └── utils/
├── alembic/                    # مهاجرت‌ها
├── requirements.txt
├── .env.example
└── README.md
```

### Frontend (Node.js)

```
frontend/
├── app/                        # Next.js App Router
│   ├── (auth)/
│   │   ├── login/
│   │   └── register/
│   ├── (dashboard)/
│   │   ├── page.tsx            # داشبورد
│   │   ├── books/
│   │   ├── questions/
│   │   ├── attempts/
│   │   ├── review/
│   │   ├── teaching/
│   │   ├── exams/
│   │   ├── topics/
│   │   └── readiness/
│   ├── layout.tsx
│   └── globals.css
├── components/
├── lib/
│   ├── api.ts                  # کلاینت API
│   ├── auth.ts
│   └── utils.ts
├── types/
├── package.json
└── README.md
```

---

## ۳. جریان احراز هویت

1. کاربر در Frontend فرم ورود/ثبت‌نام را پر می‌کند.
2. Frontend درخواست به `POST /api/auth/register` یا `POST /api/auth/login` می‌فرستد.
3. Backend رمز را هش می‌کند (bcrypt) و JWT برمی‌گرداند.
4. Frontend توکن را در حافظه امن (httpOnly cookie یا memory + refresh) نگه می‌دارد.
5. برای هر درخواست بعدی، هدر `Authorization: Bearer <token>` ارسال می‌شود.
6. Backend توکن را اعتبارسنجی می‌کند و کاربر را شناسایی می‌کند.

---

## ۴. اصول ارتباط API

- همه پاسخ‌ها JSON هستند.
- کدهای وضعیت HTTP استاندارد استفاده شود (200, 201, 400, 401, 403, 404, 422, 500).
- خطاها ساختار یکسان داشته باشند:

```json
{
  "detail": "پیام خطای فارسی"
}
```

- صفحه‌بندی برای لیست‌های بلند پشتیبانی شود.
- فیلتر و جستجو از طریق Query Parameter انجام شود.

---

## ۵. تصمیم‌های معماری مهم

| موضوع | تصمیم | دلیل |
|-------|--------|------|
| جداسازی Backend/Frontend | اجباری | مقیاس‌پذیری و استقلال فناوری |
| ORM | SQLAlchemy 2.0 | قدرتمند و استاندارد در پایتون |
| اعتبارسنجی | Pydantic v2 | هماهنگی کامل با FastAPI |
| احراز هویت | JWT | مناسب معماری جدا |
| دیتابیس شروع | SQLite | سادگی برای توسعه شخصی |
| استایل Frontend | Tailwind + RTL | سرعت و پشتیبانی فارسی |
| مدیریت حالت Frontend | React Server Components + fetch | سادگی در Next.js 15 |
