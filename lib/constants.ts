/**
 * مقادیر ثابت دامنهٔ TSP.
 *
 * نکته: SQLite در Prisma از `enum` پشتیبانی نمی‌کند، بنابراین مقادیر به‌صورت
 * `String` ذخیره می‌شوند. این فایل مرجعِ «مقادیر مجاز» و «برچسب فارسی» آن‌هاست تا
 * کل برنامه تایپ‌شده بماند و هیچ رشتهٔ سرگردانی در کد نوشته نشود.
 */

/** ابزار ساخت نگاشت برچسب‌ها با تایپ دقیق. */
function labels<T extends string>(values: readonly T[], map: Record<T, string>) {
  return { values, labels: map } as const;
}

// ---------------------------------------------------------------------------
// ساختار کتاب
// ---------------------------------------------------------------------------

export const BOOK_NODE_TYPES = labels(
  ["chapter", "section", "subsection", "mixed_tests", "checkup", "comprehensive", "other"] as const,
  {
    chapter: "فصل",
    section: "بخش",
    subsection: "زیربخش",
    mixed_tests: "تست‌های مخلوط",
    checkup: "آزمون چکاپ",
    comprehensive: "آزمون جامع",
    other: "سایر",
  },
);

export type BookNodeType = (typeof BOOK_NODE_TYPES.values)[number];

// ---------------------------------------------------------------------------
// مبحث
// ---------------------------------------------------------------------------

export const TOPIC_STATUS = labels(["active", "archived"] as const, {
  active: "فعال",
  archived: "بایگانی‌شده",
});

export type TopicStatus = (typeof TOPIC_STATUS.values)[number];

/** نوع رابطهٔ تست با مبحث (قاعدهٔ ۴ سند مدل داده). */
export const QUESTION_TOPIC_RELATIONS = labels(["primary", "secondary", "mixed"] as const, {
  primary: "اصلی",
  secondary: "فرعی",
  mixed: "مخلوط",
});

export type QuestionTopicRelation = (typeof QUESTION_TOPIC_RELATIONS.values)[number];

// ---------------------------------------------------------------------------
// تلاش‌ها
// ---------------------------------------------------------------------------

export const ATTEMPT_RESULTS = labels(["correct", "wrong", "unanswered"] as const, {
  correct: "درست",
  wrong: "غلط",
  unanswered: "نزده",
});

export type AttemptResult = (typeof ATTEMPT_RESULTS.values)[number];

export const ATTEMPT_SOURCES = labels(["manual", "review", "exam", "import"] as const, {
  manual: "دستی",
  review: "مرور",
  exam: "آزمون",
  import: "ورود داده",
});

export type AttemptSource = (typeof ATTEMPT_SOURCES.values)[number];

/** درصد، همان نتیجهٔ درست تقسیم بر کل پاسخ‌داده‌شده است؛ نزده‌ها جزء مخرج نیستند. */
export function isAnswered(result: AttemptResult): boolean {
  return result !== "unanswered";
}

// ---------------------------------------------------------------------------
// تدریس
// ---------------------------------------------------------------------------

export const TAUGHT_STATUSES = labels(["not_taught", "taught", "reviewed"] as const, {
  not_taught: "تدریس نشده",
  taught: "تدریس‌شده",
  reviewed: "مرورشده",
});

export type TaughtStatus = (typeof TAUGHT_STATUSES.values)[number];

// ---------------------------------------------------------------------------
// آزمون
// ---------------------------------------------------------------------------

export const EXAM_TYPES = labels(["single_subject", "multi_subject", "mock", "checkup"] as const, {
  single_subject: "تک‌درس",
  multi_subject: "چنددرس",
  mock: "آزمون آزمایشی",
  checkup: "چکاپ",
});

export type ExamType = (typeof EXAM_TYPES.values)[number];

// ---------------------------------------------------------------------------
// مرور هوشمند
// ---------------------------------------------------------------------------

export const REVIEW_REASONS = labels(
  ["wrong", "unanswered", "important", "hard", "backlog", "exam_related"] as const,
  {
    wrong: "غلط",
    unanswered: "نزده",
    important: "مهم",
    hard: "سخت",
    backlog: "عقب‌ماندگی",
    exam_related: "مرتبط با آزمون",
  },
);

export type ReviewReason = (typeof REVIEW_REASONS.values)[number];

export const REVIEW_STATUSES = labels(["pending", "done"] as const, {
  pending: "در انتظار",
  done: "انجام‌شده",
});

export type ReviewStatus = (typeof REVIEW_STATUSES.values)[number];

/** وزن هر دلیل در محاسبهٔ اولویت مرور؛ مجموع وزن‌ها بیشینهٔ ۱۰۰ است. */
export const REVIEW_REASON_WEIGHTS: Record<ReviewReason, number> = {
  wrong: 30,
  unanswered: 20,
  important: 25,
  hard: 15,
  backlog: 5,
  exam_related: 5,
};

// ---------------------------------------------------------------------------
// درس‌ها و رشته
// ---------------------------------------------------------------------------

/** درس‌های رایج رشتهٔ ریاضی-فیزیک؛ فهرست بسته نیست و کاربر می‌تواند درس تازه بنویسد. */
export const COMMON_SUBJECTS = [
  "ریاضی",
  "حسابان",
  "هندسه",
  "گسسته",
  "فیزیک",
  "شیمی",
] as const;

export const STUDY_FIELDS = ["ریاضی-فیزیک", "تجربی", "انسانی"] as const;

export const GRADES = ["دهم", "یازدهم", "دوازدهم", "کنکور"] as const;

/** محدودهٔ مجاز پاسخ تست؛ برای تست‌های چهارگزینه‌ای. */
export const ANSWER_CHOICES = ["1", "2", "3", "4"] as const;

export const APP_NAME = "TSP";
export const APP_TITLE = "سامانه مدیریت تست، مطالعه و آمادگی آزمون";
export const APP_VERSION = "0.2.0";
