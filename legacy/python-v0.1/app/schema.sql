-- ============================================================================
-- TSP — طرح‌واره پایگاه داده  (نسخه ۰.۱)
-- پیاده‌سازی مدل داده سند ۰۴ و قواعد اعتبارسنجی سند ۰۳
--
-- اصول حاکم بر این طرح‌واره:
--   قاعده ۱: display_number یکتا نیست، question.code یکتاست.
--   قاعده ۲: مکان تست در book_node ثبت می‌شود.
--   قاعده ۳: BookNode (ساختار کتاب) با Topic (مبحث آموزشی) یکی نیست.
--   قاعده ۴: مجموعه «تست‌های مخلوط» می‌تواند به چند Topic وصل شود.
--   قاعده ۵: آزمون چکاپ/جامع گره ارزیابی است، نه مبحث آموزشی.
--   قاعده ۶: publisher_difficulty و user_hard و user_important سه مفهوم جدا.
--   قاعده ۷: هر تلاش جدید یعنی رکورد جدید؛ رکورد قبلی تغییر/حذف نمی‌شود.
--   قاعده ۸: previous_question_entry با question_attempt یکی نیست.
--   قاعده ۹: Exam تعریف آزمون است و ExamAttempt اجرای آن.
--   قاعده ۱۰: آمار از داده خام محاسبه می‌شود، نه از مقدار خلاصه جایگزین.
-- ============================================================================

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS app_meta (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- ---------------------------------------------------------------------------
-- ۱) مرکز منابع : درس، کتاب، ساختار کتاب
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS subject (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    name           TEXT    NOT NULL,
    grade          TEXT,                      -- پایه
    field_of_study TEXT,                      -- رشته
    color          TEXT,                      -- رنگ نمایشی (اختیاری)
    notes          TEXT,
    state          TEXT    NOT NULL DEFAULT 'active'
                           CHECK (state IN ('active', 'archived')),
    created_at     TEXT    NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_subject_name ON subject(name, IFNULL(grade, ''));

CREATE TABLE IF NOT EXISTS book (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    -- درس می‌تواند بعداً تعیین شود؛ بنابراین اجباری نیست
    subject_id   INTEGER REFERENCES subject(id),
    publisher    TEXT,
    title        TEXT    NOT NULL,
    grade        TEXT,
    field_of_study TEXT,
    edition_year TEXT,                        -- edition/year
    notes        TEXT,
    state        TEXT    NOT NULL DEFAULT 'active'
                         CHECK (state IN ('active', 'archived')),
    created_at   TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_book_subject ON book(subject_id);

CREATE TABLE IF NOT EXISTS book_node (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    book_id     INTEGER NOT NULL REFERENCES book(id),
    parent_id   INTEGER REFERENCES book_node(id),
    node_type   TEXT    NOT NULL
                        CHECK (node_type IN (
                            'book', 'chapter', 'lesson', 'section', 'subsection',
                            'test_set', 'mixed_tests', 'checkup_exam',
                            'comprehensive_exam', 'entrance_exam',
                            'other_assessment'
                        )),
    title       TEXT    NOT NULL,
    order_index INTEGER NOT NULL DEFAULT 0,
    notes       TEXT,
    state       TEXT    NOT NULL DEFAULT 'active'
                        CHECK (state IN ('active', 'archived')),
    created_at  TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_book_node_book   ON book_node(book_id, parent_id, order_index);
CREATE INDEX IF NOT EXISTS ix_book_node_parent ON book_node(parent_id);

-- ---------------------------------------------------------------------------
-- ۲) ساختار مباحث (مستقل از ساختار فیزیکی کتاب)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS topic (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    subject_id  INTEGER REFERENCES subject(id),
    parent_id   INTEGER REFERENCES topic(id),
    title       TEXT    NOT NULL,
    -- وضعیت مبحث آموزشی، جدا از گره ساختاری کتاب
    status      TEXT    NOT NULL DEFAULT 'active'
                        CHECK (status IN ('planned', 'active', 'in_progress',
                                          'mastered', 'archived')),
    order_index INTEGER NOT NULL DEFAULT 0,
    notes       TEXT,
    created_at  TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_topic_subject ON topic(subject_id, parent_id, order_index);

-- ---------------------------------------------------------------------------
-- ۳) بانک تست
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS question (
    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
    code                 TEXT    NOT NULL UNIQUE,   -- شناسه داخلی یکتا : Q-000184
    book_id              INTEGER REFERENCES book(id),
    book_node_id         INTEGER REFERENCES book_node(id),
    display_number       TEXT,                      -- شماره نمایشی (یکتا نیست)
    correct_answer       TEXT,
    publisher_difficulty TEXT,                      -- سختی اعلام‌شده ناشر
    reference            TEXT,                      -- source/reference
    notes                TEXT,
    state                TEXT    NOT NULL DEFAULT 'active'
                                 CHECK (state IN ('active', 'archived')),
    created_at           TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_question_book  ON question(book_id, book_node_id);
CREATE INDEX IF NOT EXISTS ix_question_state ON question(state);
CREATE INDEX IF NOT EXISTS ix_question_disp  ON question(book_id, book_node_id, display_number);

-- رابطه چندبه‌چند تست و مبحث آموزشی
CREATE TABLE IF NOT EXISTS question_topic (
    question_id   INTEGER NOT NULL REFERENCES question(id),
    topic_id      INTEGER NOT NULL REFERENCES topic(id),
    relation_type TEXT    NOT NULL DEFAULT 'primary',
                          -- primary | secondary | mixed | exam | other
    created_at    TEXT    NOT NULL,
    PRIMARY KEY (question_id, topic_id, relation_type)
);
CREATE INDEX IF NOT EXISTS ix_question_topic_topic ON question_topic(topic_id);

-- ویژگی‌های کاربر برای تست (کاملاً جدا از publisher_difficulty)
CREATE TABLE IF NOT EXISTS user_question_flag (
    question_id INTEGER PRIMARY KEY REFERENCES question(id),
    important   INTEGER NOT NULL DEFAULT 0 CHECK (important IN (0, 1)),
    hard        INTEGER NOT NULL DEFAULT 0 CHECK (hard IN (0, 1)),
    updated_at  TEXT    NOT NULL
);

-- ---------------------------------------------------------------------------
-- ۴) ثبت سابقه تست
-- ---------------------------------------------------------------------------

-- تلاش جدید: هر بار حل یک رکورد تازه
CREATE TABLE IF NOT EXISTS question_attempt (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    question_id   INTEGER NOT NULL REFERENCES question(id),
    user_answer   TEXT,
    result        TEXT    NOT NULL
                          CHECK (result IN ('correct', 'incorrect', 'unanswered')),
    spent_seconds INTEGER,
    attempted_at  TEXT    NOT NULL,                 -- تاریخ و ساعت (الزامی)
    source        TEXT    NOT NULL DEFAULT 'app',   -- app | review | exam | other
    exam_attempt_id INTEGER REFERENCES exam_attempt(id),
    review_item_id  INTEGER REFERENCES review_item(id),
    notes         TEXT,
    -- رکورد تلاش هرگز بازنویسی نمی‌شود؛ برای اصلاح اشتباه ورود، رکورد «باطل»
    -- می‌شود تا در آمار شمرده نشود ولی سابقه باقی بماند (قاعده ۷).
    state         TEXT    NOT NULL DEFAULT 'active'
                          CHECK (state IN ('active', 'voided')),
    void_reason   TEXT,
    voided_at     TEXT,
    created_at    TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_attempt_question ON question_attempt(question_id, attempted_at);
CREATE INDEX IF NOT EXISTS ix_attempt_time     ON question_attempt(attempted_at);
CREATE INDEX IF NOT EXISTS ix_attempt_source   ON question_attempt(source);
CREATE INDEX IF NOT EXISTS ix_attempt_state    ON question_attempt(state);

-- سابقه تست‌های حل‌شده پیش از استفاده از نرم‌افزار (بدون تاریخ الزامی)
CREATE TABLE IF NOT EXISTS previous_question_entry (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    question_id     INTEGER NOT NULL REFERENCES question(id),
    user_answer     TEXT,
    result          TEXT    NOT NULL
                            CHECK (result IN ('correct', 'incorrect', 'unanswered')),
    imported_at     TEXT    NOT NULL,
    import_batch_id INTEGER REFERENCES import_batch(id),
    note            TEXT,
    state           TEXT    NOT NULL DEFAULT 'active'
                            CHECK (state IN ('active', 'voided')),
    void_reason     TEXT,
    voided_at       TEXT,
    created_at      TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_prev_question ON previous_question_entry(question_id);
CREATE INDEX IF NOT EXISTS ix_prev_batch    ON previous_question_entry(import_batch_id);

CREATE TABLE IF NOT EXISTS import_batch (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    kind        TEXT    NOT NULL,     -- previous_entries | questions | full_json | sample
    label       TEXT,
    file_name   TEXT,
    counts      TEXT,                 -- JSON: {"created": n, "skipped": m, ...}
    warnings    TEXT,                 -- JSON array
    created_at  TEXT    NOT NULL
);

-- ---------------------------------------------------------------------------
-- ۶) تدریس و عقب‌ماندگی
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS teaching_unit (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    topic_id      INTEGER NOT NULL UNIQUE REFERENCES topic(id),
    taught_status TEXT    NOT NULL DEFAULT 'not_started'
                          CHECK (taught_status IN ('not_started', 'in_progress',
                                                   'taught', 'needs_review')),
    taught_at     TEXT,
    notes         TEXT,
    updated_at    TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS teaching_test_goal (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    topic_id     INTEGER NOT NULL REFERENCES topic(id),
    target_count INTEGER NOT NULL CHECK (target_count >= 0),
    period_label TEXT,
    period_start TEXT,
    period_end   TEXT,
    notes        TEXT,
    status       TEXT    NOT NULL DEFAULT 'active'
                         CHECK (status IN ('active', 'done', 'archived')),
    created_at   TEXT    NOT NULL,
    updated_at   TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_goal_topic ON teaching_test_goal(topic_id, status);

-- ---------------------------------------------------------------------------
-- ۷ و ۸) مدیریت آزمون و سوابق آزمون
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS exam (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    title        TEXT    NOT NULL,
    exam_type    TEXT    NOT NULL DEFAULT 'single_subject'
                         CHECK (exam_type IN ('single_subject', 'mock_multi_subject',
                                              'book_assessment', 'other')),
    subject_id   INTEGER REFERENCES subject(id),
    planned_date TEXT,                       -- تاریخ برگزاری برنامه‌ریزی‌شده
    notes        TEXT,
    status       TEXT    NOT NULL DEFAULT 'planned'
                         CHECK (status IN ('planned', 'ready', 'held',
                                           'analyzed', 'archived')),
    book_node_id INTEGER REFERENCES book_node(id),  -- اگر از دل کتاب ساخته شده
    created_at   TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_exam_date ON exam(planned_date);

CREATE TABLE IF NOT EXISTS exam_topic (
    exam_id  INTEGER NOT NULL REFERENCES exam(id),
    topic_id INTEGER NOT NULL REFERENCES topic(id),
    weight   REAL    NOT NULL DEFAULT 1,
    PRIMARY KEY (exam_id, topic_id)
);

CREATE TABLE IF NOT EXISTS exam_question (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    exam_id        INTEGER NOT NULL REFERENCES exam(id),
    question_id    INTEGER REFERENCES question(id),
    display_number TEXT,
    correct_answer TEXT,
    topic_id       INTEGER REFERENCES topic(id),
    points         REAL    NOT NULL DEFAULT 1,
    order_index    INTEGER NOT NULL DEFAULT 0,
    created_at     TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_exam_question_exam ON exam_question(exam_id, order_index);

CREATE TABLE IF NOT EXISTS exam_attempt (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    exam_id            INTEGER NOT NULL REFERENCES exam(id),
    started_at         TEXT,
    finished_at        TEXT,
    total_questions    INTEGER NOT NULL DEFAULT 0,
    correct_count      INTEGER NOT NULL DEFAULT 0,
    incorrect_count    INTEGER NOT NULL DEFAULT 0,
    unanswered_count   INTEGER NOT NULL DEFAULT 0,
    score_percent      REAL,
    spent_seconds      INTEGER,
    summary            TEXT,
    notes              TEXT,
    state              TEXT    NOT NULL DEFAULT 'running'
                               CHECK (state IN ('running', 'finished', 'archived')),
    created_at         TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_exam_attempt_exam ON exam_attempt(exam_id, started_at);

CREATE TABLE IF NOT EXISTS exam_answer (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    exam_attempt_id INTEGER NOT NULL REFERENCES exam_attempt(id),
    exam_question_id INTEGER NOT NULL REFERENCES exam_question(id),
    user_answer     TEXT,
    result          TEXT    CHECK (result IN ('correct', 'incorrect', 'unanswered')),
    spent_seconds   INTEGER,
    answered_at     TEXT,
    UNIQUE (exam_attempt_id, exam_question_id)
);

CREATE TABLE IF NOT EXISTS exam_asset (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    exam_id          INTEGER REFERENCES exam(id),
    exam_question_id INTEGER REFERENCES exam_question(id),
    file_type        TEXT    NOT NULL,      -- pdf | image | other
    file_path        TEXT    NOT NULL,
    original_name    TEXT,
    byte_size        INTEGER,
    metadata         TEXT,                  -- JSON
    created_at       TEXT    NOT NULL
);

-- ---------------------------------------------------------------------------
-- ۹) آمادگی آزمون
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS future_exam_plan (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    exam_id            INTEGER REFERENCES exam(id),
    title              TEXT    NOT NULL,
    exam_date          TEXT,
    target             TEXT,
    preparation_status TEXT    NOT NULL DEFAULT 'planning'
                               CHECK (preparation_status IN ('planning', 'studying',
                                                             'reviewing', 'ready', 'done')),
    readiness_estimate REAL,
    readiness_details  TEXT,                 -- JSON تحلیل مؤلفه‌ها
    evaluated_at       TEXT,
    notes              TEXT,
    created_at         TEXT    NOT NULL,
    updated_at         TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS future_exam_plan_topic (
    plan_id INTEGER NOT NULL REFERENCES future_exam_plan(id),
    topic_id INTEGER NOT NULL REFERENCES topic(id),
    weight  REAL    NOT NULL DEFAULT 1,
    PRIMARY KEY (plan_id, topic_id)
);

-- ---------------------------------------------------------------------------
-- فهرست مرور
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS review_item (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    question_id INTEGER REFERENCES question(id),
    topic_id    INTEGER REFERENCES topic(id),
    reasons     TEXT    NOT NULL DEFAULT '[]',   -- JSON آرایه دلایل
    priority    INTEGER NOT NULL DEFAULT 0,
    state       TEXT    NOT NULL DEFAULT 'open'
                        CHECK (state IN ('open', 'in_progress', 'resolved', 'archived')),
    origin      TEXT    NOT NULL DEFAULT 'auto', -- auto | manual | goal | exam | plan
    origin_ref  TEXT,
    note        TEXT,
    created_at  TEXT    NOT NULL,
    updated_at  TEXT    NOT NULL,
    resolved_at TEXT,
    CHECK (question_id IS NOT NULL OR topic_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS ix_review_state    ON review_item(state, priority DESC);
CREATE INDEX IF NOT EXISTS ix_review_question ON review_item(question_id);
CREATE UNIQUE INDEX IF NOT EXISTS ux_review_open_question
    ON review_item(question_id) WHERE state IN ('open', 'in_progress')
      AND question_id IS NOT NULL;
-- برای موارد سطح مبحث (باقی‌مانده از هدف، آزمون آینده)
CREATE UNIQUE INDEX IF NOT EXISTS ux_review_open_topic
    ON review_item(topic_id) WHERE state IN ('open', 'in_progress')
      AND topic_id IS NOT NULL AND question_id IS NULL;

-- ---------------------------------------------------------------------------
-- گزارش رویدادها (برای جریان فعالیت داشبورد)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS activity_log (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    at         TEXT NOT NULL,
    kind       TEXT NOT NULL,
    entity     TEXT,
    entity_id  INTEGER,
    message    TEXT NOT NULL,
    payload    TEXT
);
CREATE INDEX IF NOT EXISTS ix_activity_at ON activity_log(at DESC);
