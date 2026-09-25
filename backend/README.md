# TSP Backend

بک‌اند نسخه اول سامانه TSP (مدیریت تست، مطالعه و آمادگی آزمون).

این فاز این کارها را پوشش می‌دهد:

- ثبت‌نام و ورود با JWT
- ساخت کتاب تست
- تعریف ساختار فصل و بخش (`BookNode`)
- ثبت تست با شماره نمایشی و پاسخ صحیح، بدون ذخیره متن سؤال
- حل تست و دیدن نتیجه درست / غلط / بی‌پاسخ به‌همراه درصد
- حفظ تاریخچه: هر تلاش یک رکورد جدید است و بازنویسی نمی‌شود

مدل‌های این فاز: `User`، `Book`، `BookNode`، `Question`، `QuestionAttempt`.

پورت سرویس: **8000**  
پیشوند API: `http://localhost:8000/api/v1`

## پیش‌نیاز

- Python 3.11 یا جدیدتر
- pip

## اجرا

دستورها را از داخل پوشه `backend` اجرا کنید.

### ویندوز

```bat
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
alembic upgrade head
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### لینوکس / مک

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
alembic upgrade head
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

اگر فایل `.env` نسازید، برنامه با مقدارهای توسعه بالا می‌آید، ولی بهتر است `SECRET_KEY` را عوض کنید.

بعد از بالا آمدن:

- سلامت: http://localhost:8000/health
- مستندات تعاملی: http://localhost:8000/docs

## متغیرهای محیطی

| متغیر | معنی | پیش‌فرض |
|---|---|---|
| `DATABASE_URL` | آدرس پایگاه داده | فایل `tsp.db` کنار همین پوشه |
| `SECRET_KEY` | کلید امضای JWT | مقدار توسعه؛ در استفاده واقعی عوض شود |
| `ALGORITHM` | الگوریتم JWT | `HS256` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | عمر توکن به دقیقه | `10080` (۷ روز) |
| `CORS_ORIGINS` | مبدأهای مجاز، با کاما | `http://localhost:3000,http://127.0.0.1:3000` |
| `CORS_ORIGIN_REGEX` | الگوی مبدأ اضافی | پیش‌نمایش‌های `e2b.app` |

## قواعدی که کد رعایت می‌کند

- `display_number` یکتا نیست. شناسه واقعی `Question.id` است.
- متن سؤال فیلد ندارد و ذخیره نمی‌شود.
- `POST /attempts` فقط رکورد جدید می‌سازد. ویرایش و حذف تلاش مجاز نیست.
- نتیجه را سرور از مقایسه پاسخ کاربر با پاسخ صحیح حساب می‌کند.
- درصد = تعداد درست ÷ کل تلاش‌ها × ۱۰۰. غلط و بی‌پاسخ هم در مخرج هستند.
- آمار ذخیره نمی‌شود؛ هر بار از روی رکوردهای خام محاسبه می‌شود.
- کتاب و تست متعلق به کاربر دیگر با ۴۰۴ پاسخ داده می‌شود.
- پیام‌های خطا فارسی هستند.

ارقام فارسی و عربی در پاسخ با رقم انگلیسی یکی گرفته می‌شوند. مثلاً پاسخ صحیح `۳` و پاسخ کاربر `3` درست است. پاسخ خالی یعنی بی‌پاسخ.

## تست خودکار

```bash
pip install -r requirements-dev.txt
pytest
```

این تست همان سناریوی اصلی را پوشش می‌دهد: ثبت‌نام، ورود، کتاب، فصل، بخش، دو تست با شماره نمایشی یکسان، سه تلاش، و دست‌نخوردن رکورد اول.

## تست دستی سناریو با curl

بک‌اند باید روی پورت ۸۰۰۰ روشن باشد. در لینوکس / مک:

```bash
BASE=http://localhost:8000/api/v1

curl -s -X POST $BASE/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"student@example.com","password":"secret123","name":"نگار"}'

TOKEN=$(curl -s -X POST $BASE/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"student@example.com","password":"secret123"}' | python -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

BOOK=$(curl -s -X POST $BASE/books \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"title":"شیمی ۲ مبتکران","subject":"شیمی","publisher":"مبتکران","grade":"یازدهم"}')
BOOK_ID=$(printf '%s' "$BOOK" | python -c "import sys,json; print(json.load(sys.stdin)['id'])")

CHAPTER=$(curl -s -X POST $BASE/books/$BOOK_ID/nodes \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"node_type":"chapter","title":"فصل ۱"}')
CHAPTER_ID=$(printf '%s' "$CHAPTER" | python -c "import sys,json; print(json.load(sys.stdin)['id'])")

SECTION=$(curl -s -X POST $BASE/books/$BOOK_ID/nodes \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d "{\"node_type\":\"section\",\"title\":\"بخش الگوها\",\"parent_id\":\"$CHAPTER_ID\"}")
SECTION_ID=$(printf '%s' "$SECTION" | python -c "import sys,json; print(json.load(sys.stdin)['id'])")

QUESTION=$(curl -s -X POST $BASE/questions \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d "{\"book_id\":\"$BOOK_ID\",\"book_node_id\":\"$SECTION_ID\",\"display_number\":\"12\",\"correct_answer\":\"3\"}")
QUESTION_ID=$(printf '%s' "$QUESTION" | python -c "import sys,json; print(json.load(sys.stdin)['id'])")

curl -s -X POST $BASE/attempts \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d "{\"question_id\":\"$QUESTION_ID\",\"user_answer\":\"3\",\"spent_seconds\":40}"

curl -s -X POST $BASE/attempts \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d "{\"question_id\":\"$QUESTION_ID\",\"user_answer\":\"1\"}"

curl -s "$BASE/attempts?question_id=$QUESTION_ID" -H "Authorization: Bearer $TOKEN"
```

انتظار:

- تلاش اول `result` برابر `correct` باشد.
- تلاش دوم `result` برابر `wrong` باشد.
- فهرست تلاش‌ها دو رکورد جدا داشته باشد و نتیجه اول هنوز `correct` باشد.
- پاسخ ثبت تلاش، فیلدهای `question` و `book` و `overall` را با `percentage` برگرداند.

در Swagger هم می‌توانید همین مسیر را با دکمه Authorize و مقدار `Bearer <token>` تست کنید.

## مسیرهای این فاز

| روش | مسیر | کار |
|---|---|---|
| POST | `/api/v1/auth/register` | ثبت‌نام |
| POST | `/api/v1/auth/login` | ورود و دریافت JWT |
| GET | `/api/v1/auth/me` | کاربر جاری |
| GET/POST | `/api/v1/books` | فهرست و ساخت کتاب |
| GET/PATCH/DELETE | `/api/v1/books/{id}` | جزئیات، ویرایش، آرشیو |
| POST | `/api/v1/books/{id}/nodes` | افزودن فصل یا بخش |
| PATCH/DELETE | `/api/v1/nodes/{id}` | ویرایش یا حذف گره |
| GET/POST | `/api/v1/questions` | فهرست و ثبت تست |
| GET/PATCH | `/api/v1/questions/{id}` | جزئیات و ویرایش تست |
| POST/GET | `/api/v1/attempts` | ثبت تلاش جدید و تاریخچه |
| GET | `/api/v1/dashboard/summary` | خلاصه درصد و شمارنده‌ها |
| GET | `/health` | سلامت سرویس و پایگاه داده |

حذف کتاب به‌طور پیش‌فرض آرشیو است. حذف فیزیکی: `DELETE /api/v1/books/{id}?permanent=true`.

مباحث آموزشی، مرور، تدریس، آزمون و آمادگی در اسناد `TSP_v0.3_docs` برای فازهای بعد هستند و در این نسخه پیاده نشده‌اند.
