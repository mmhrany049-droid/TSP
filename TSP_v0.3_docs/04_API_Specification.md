# مشخصات کامل API — TSP v0.3 Backend

پایه آدرس: `http://localhost:8000/api/v1`

تمام مسیرهای محافظت‌شده نیاز به هدر دارند:
```
Authorization: Bearer <access_token>
```

---

## ۱. احراز هویت (`/auth`)

### POST /auth/register
ثبت‌نام کاربر جدید.

**بدنه:**
```json
{
  "email": "user@example.com",
  "password": "strongpassword",
  "name": "نام کاربر"
}
```

**پاسخ موفق (201):**
```json
{
  "id": "...",
  "email": "...",
  "name": "..."
}
```

### POST /auth/login
**بدنه:**
```json
{
  "email": "user@example.com",
  "password": "strongpassword"
}
```

**پاسخ موفق (200):**
```json
{
  "access_token": "...",
  "token_type": "bearer",
  "user": {
    "id": "...",
    "email": "...",
    "name": "..."
  }
}
```

### GET /auth/me
اطلاعات کاربر جاری.

---

## ۲. کتاب‌ها (`/books`)

### GET /books
لیست کتاب‌های کاربر.

### POST /books
ایجاد کتاب جدید.

### GET /books/{book_id}
جزئیات کتاب + ساختار درختی (BookNodes).

### PATCH /books/{book_id}
ویرایش کتاب.

### DELETE /books/{book_id}
آرشیو یا حذف کتاب.

### POST /books/{book_id}/nodes
افزودن گره ساختاری (فصل/بخش/...).

### PATCH /nodes/{node_id}
ویرایش گره.

### DELETE /nodes/{node_id}
حذف گره (با بررسی فرزندان).

---

## ۳. تست‌ها (`/questions`)

### GET /questions
لیست تست‌ها با فیلتر:
- book_id
- book_node_id
- topic_id
- is_important
- is_hard
- is_active

### POST /questions
ایجاد تست جدید.

### GET /questions/{question_id}
جزئیات یک تست.

### PATCH /questions/{question_id}
ویرایش (از جمله is_important و is_hard).

### POST /questions/{question_id}/topics
اتصال تست به مبحث.

---

## ۴. تلاش‌ها (`/attempts`)

### POST /attempts
ثبت تلاش جدید.

**بدنه:**
```json
{
  "question_id": "...",
  "user_answer": "2",
  "spent_seconds": 45,
  "source": "manual"
}
```

سیستم خودش result را بر اساس correct_answer محاسبه می‌کند.

### GET /attempts
لیست تلاش‌ها با فیلتر (question_id، بازه زمانی، result و ...).

### POST /previous-solved
ورود تست‌های قبلاً حل‌شده (دسته‌ای یا تکی).

---

## ۵. مباحث (`/topics`)

### GET /topics
درخت یا لیست مباحث.

### POST /topics
ایجاد مبحث.

### PATCH /topics/{topic_id}
ویرایش.

### GET /topics/{topic_id}/questions
تست‌های متصل به یک مبحث.

---

## ۶. تدریس (`/teaching`)

### GET /teaching/records
وضعیت تدریس مباحث.

### PUT /teaching/records/{topic_id}
ثبت یا به‌روزرسانی وضعیت تدریس.

### GET /teaching/goals
اهداف تست.

### POST /teaching/goals
تعریف هدف جدید.

### GET /teaching/progress
خلاصه پیشرفت + عقب‌ماندگی.

---

## ۷. مرور (`/review`)

### GET /review/items
لیست آیتم‌های مرور با فیلتر دلایل.

### POST /review/generate
تولید لیست مرور بر اساس فیلترهای انتخاب‌شده (غلط، نزده، مهم، سخت، عقب‌مانده و ...).

### PATCH /review/items/{item_id}
تغییر وضعیت به done.

---

## ۸. آزمون‌ها (`/exams`)

### GET /exams
لیست آزمون‌ها.

### POST /exams
ایجاد آزمون.

### GET /exams/{exam_id}
جزئیات + سؤالات + مباحث.

### POST /exams/{exam_id}/questions
افزودن سؤال به آزمون.

### POST /exams/{exam_id}/attempts
شروع اجرای جدید آزمون.

### POST /exam-attempts/{attempt_id}/answers
ثبت پاسخ‌های یک اجرا.

### GET /exam-attempts/{attempt_id}
نتیجه یک اجرا.

### POST /exams/{exam_id}/assets
آپلود فایل سؤال (PDF/تصویر).

---

## ۹. آمادگی آزمون (`/readiness`)

### POST /readiness/plans
ایجاد برنامه آمادگی برای آزمون آینده (انتخاب مباحث).

### GET /readiness/plans/{plan_id}
جزئیات برنامه + برآورد درصد + لیست کارهای پیشنهادی.

### POST /readiness/plans/{plan_id}/recalculate
محاسبه مجدد برآورد.

---

## ۱۰. داشبورد (`/dashboard`)

### GET /dashboard/summary
خلاصه کلی:
- تعداد تست‌ها و تلاش‌ها
- درصد کلی
- تعداد غلط / نزده / مهم / سخت
- عقب‌ماندگی‌ها
- آزمون‌های آینده
- آخرین فعالیت‌ها

### GET /dashboard/by-topic
درصد و آمار به تفکیک مبحث.

### GET /dashboard/by-book
آمار به تفکیک کتاب و فصل.

---

## ۱۱. سلامت سیستم

### GET /health
بررسی سلامت Backend و اتصال دیتابیس.

---

## قوانین عمومی API

- تمام پیام‌های خطا فارسی باشند.
- اعتبارسنجی ورودی با Pydantic انجام شود.
- صفحه‌بندی پیش‌فرض: page + size.
- تاریخ‌ها در پاسخ به صورت ISO 8601 برگردانده شوند (Frontend مسئول نمایش شمسی است).
