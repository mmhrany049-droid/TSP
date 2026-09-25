# پرامپت‌های ساخت Backend (Python / FastAPI)

قبل از هر پرامپت این متن را اضافه کن:

> تو یک توسعه‌دهنده ارشد پایتون و FastAPI هستی. کد تمیز، تایپ‌شده، مستند و مطابق بهترین شیوه‌ها بنویس. تمام پیام‌های خطا و مستندات API باید فارسی باشند. از SQLAlchemy 2.0 و Pydantic v2 استفاده کن. پروژه باید قابل اجرا روی ویندوز باشد.

---

## پرامپت ۱: اسکلت پروژه Backend

```
یک پروژه کامل FastAPI برای سامانه TSP بساز.

ساختار پوشه‌ها دقیقاً مطابق سند معماری باشد:
backend/
  app/
    main.py
    config.py
    database.py
    models/
    schemas/
    api/
    services/
    core/
    utils/
  alembic/
  requirements.txt
  .env.example
  README.md

کارهایی که باید انجام دهی:
1. فایل requirements.txt را با نسخه‌های مناسب پر کن.
2. config.py با pydantic-settings برای خواندن متغیرهای محیطی.
3. database.py با SQLAlchemy 2.0 و پشتیبانی از SQLite.
4. main.py با FastAPI، CORS برای Frontend، و روترها.
5. مدل‌های SQLAlchemy را دقیقاً بر اساس سند مدل داده (03_Data_Model_Full.md) پیاده کن.
6. Alembic را راه‌اندازی کن.
7. یک endpoint ساده /health اضافه کن.

هنوز منطق APIها را کامل ننویس. فقط اسکلت + مدل‌ها + تنظیمات.
```

---

## پرامپت ۲: احراز هویت کامل

```
ماژول AuthCore را کامل پیاده‌سازی کن.

قابلیت‌ها:
- ثبت‌نام (email + password + name)
- ورود و صدور JWT
- هش رمز با bcrypt
- dependency برای گرفتن کاربر جاری
- محافظت از مسیرها
- endpoint /auth/me

فایل‌های مرتبط:
- app/core/security.py
- app/core/deps.py
- app/api/auth.py
- app/schemas/auth.py
- app/services/auth.py

پیام‌های خطا باید فارسی و امن باشند (نباید مشخص شود ایمیل وجود دارد یا نه).
```

---

## پرامپت ۳: مدیریت کتاب و ساختار

```
ماژول LibraryManager را کامل پیاده کن.

قابلیت‌ها:
- CRUD کتاب
- مدیریت درخت BookNode (افزودن، ویرایش، حذف، جابجایی ترتیب)
- پشتیبانی از انواع گره: chapter, section, subsection, mixed_tests, checkup, comprehensive, other
- برگرداندن ساختار درختی کامل یک کتاب
- فیلتر و آرشیو

APIها مطابق سند 04_API_Specification.md باشد.
```

---

## پرامپت ۴: بانک تست و مباحث

```
ماژول‌های QuestionBank و TopicTree را پیاده کن.

قابلیت‌های الزامی:
- ثبت تست با شناسه یکتا و display_number (که یکتا نیست)
- علامت is_important و is_hard
- اتصال تست به BookNode
- CRUD مباحث (Topic) به صورت درختی
- رابطه چندبه‌چند QuestionTopic
- فیلتر تست‌ها بر اساس کتاب، گره، مبحث، مهم، سخت

هیچ متن سؤالی ذخیره نشود.
```

---

## پرامپت ۵: تلاش‌ها و مرور

```
ماژول‌های AttemptTracker و SmartReview را کامل پیاده کن.

قواعد بحرانی:
- هر POST /attempts یک رکورد جدید QuestionAttempt می‌سازد (هرگز update نکن)
- result را سرور بر اساس correct_answer محاسبه کند
- پشتیبانی از PreviousSolvedEntry
- تولید لیست مرور بر اساس ترکیب فیلترها (غلط، نزده، مهم، سخت، عقب‌مانده و ...)
- مدیریت وضعیت pending/done برای ReviewItem
```

---

## پرامپت ۶: تدریس، آزمون، آمادگی و داشبورد

```
ماژول‌های باقی‌مانده را پیاده کن:

1. TeachingProgress:
   - ثبت وضعیت تدریس
   - هدف تعداد تست
   - محاسبه عقب‌ماندگی

2. ExamCenter:
   - تعریف آزمون
   - افزودن سؤال
   - شروع ExamAttempt
   - ثبت پاسخ‌ها
   - آپلود فایل (اختیاری در این مرحله)

3. ReadinessEngine:
   - ایجاد برنامه آمادگی
   - برآورد درصد (الگوریتم ساده ولی شفاف بر اساس داده‌های موجود)
   - تولید لیست کار پیشنهادی

4. AnalyticsDashboard:
   - خلاصه کلی
   - آمار به تفکیک مبحث و کتاب
```

---

## پرامپت ۷: نهایی‌سازی Backend

```
1. تمام endpointها را تست‌پذیر و مستند کن (docstring فارسی).
2. مدیریت خطای سراسری اضافه کن.
3. CORS را برای http://localhost:3000 تنظیم کن.
4. README.md کامل Backend را بنویس (نحوه اجرا، متغیرهای محیطی، ساخت دیتابیس).
5. مطمئن شو با دستورات زیر پروژه بالا می‌آید:
   - python -m venv venv
   - pip install -r requirements.txt
   - alembic upgrade head
   - uvicorn app.main:app --reload --port 8000
```
