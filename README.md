# تی‌اس‌پی (TSP) نسخه ۰.۳

وب‌اپ شخصی فارسی و راست‌چین برای مدیریت تست، پیگیری مطالعه و آمادگی آزمون دانش‌آموز رشته ریاضی‌فیزیک. معماری کاملاً جدا و REST محور است: FastAPI + SQLite در Backend و Next.js 15 + TypeScript + Tailwind در Frontend.

## اجرای محلی

### ۱. Backend (پورت ۸۰۰۰)

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # ویندوز: .venv\\Scripts\\activate
pip install -r requirements.txt
cp .env.example .env       # ویندوز: copy .env.example .env
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### ۲. Frontend (پورت ۳۰۰۰، ترمینال جدا)

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

باز کنید: `http://localhost:3000`. مسیرهای `/api/v1/*` از طریق rewrite در Next به Backend منتقل می‌شوند. `TSP_BACKEND_URL` در `frontend/.env.local` و `CORS_ORIGINS` در `backend/.env` را متناسب با محیط اجرا تنظیم کنید. پیش از استفاده واقعی، `SECRET_KEY` را در Backend با یک کلید تصادفی امن جایگزین کنید.

## امکانات پیاده‌سازی‌شده

- ثبت‌نام، ورود JWT و محافظت از اپلیکیشن
- مدیریت کتاب و ساختار انعطاف‌پذیر BookNode
- بانک تست با شماره غیر یکتا و بدون ذخیره متن سؤال
- تلاش‌های تغییرناپذیر و سابقه تست‌های قبلی در جداول جدا
- برچسب مهم/سخت مستقل از سختی ناشر
- درخت مستقل مباحث آموزشی، تدریس و هدف‌گذاری
- تولید فهرست مرور، ساخت آزمون و نگهداری اجرا/پاسخ‌ها
- برنامه آمادگی، تخمین درصد و فهرست کار پیشنهادی
- داشبورد با محاسبه آمار از داده‌های خام

مستندات API: `http://localhost:8000/docs`، وضعیت: `http://localhost:8000/api/v1/health`. توضیحات نصب جزئی‌تر در `backend/README.md` و `frontend/README.md` است.
