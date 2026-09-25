# راه‌اندازی Frontend تی‌اس‌پی ۰.۳

نیازمندی: Node.js 20 یا جدیدتر.

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

Frontend روی `http://localhost:3000` اجرا می‌شود. مقدار `TSP_BACKEND_URL` در `.env.local` باید به Backend در دسترس از محیط اجرای Next.js اشاره کند. مسیرهای `/api/v1/*` با rewrite داخلی Next.js به سرویس FastAPI می‌روند؛ بنابراین مرورگر فقط از مسیر نسبی REST استفاده می‌کند.

صفحه ورود و ثبت‌نام در `/login` و `/register` قرار دارند. بعد از ورود، اپلیکیشن توکن JWT را در localStorage نگه می‌دارد و هدر Bearer را برای درخواست‌های API می‌فرستد. برای اجرای نسخه آماده انتشار:

```bash
npm run build
npm start
```

رابط کاربری فارسی و RTL است و شامل داشبورد، کتاب‌ها و ساختار درختی، بانک تست، تلاش‌ها، مرور، تدریس، آزمون‌ها، آمادگی آزمون و مباحث آموزشی می‌شود.
