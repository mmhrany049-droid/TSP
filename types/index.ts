import type { Prisma } from "@prisma/client";

import type {
  AttemptResult,
  AttemptSource,
  BookNodeType,
  ExamType,
  ReviewReason,
  TaughtStatus,
  TopicStatus,
} from "@/lib/constants";

/**
 * تایپ‌های مشترک برنامه.
 *
 * مدل‌های پایگاه داده از خود Prisma گرفته می‌شوند (`Prisma.ModelGetPayload`) تا
 * هیچ‌گاه دوباره‌نویسی نشوند و با تغییر schema هم‌گام بمانند.
 */

/** کتاب همراه ساختار و تعداد تست‌ها (برای صفحهٔ کتاب‌ها). */
export type BookWithStats = Prisma.BookGetPayload<{
  include: { _count: { select: { nodes: true; questions: true } } };
}>;

/** گرهٔ کتاب به‌همراه فرزندان، برای نمایش درختی. */
export type BookNodeTree = Prisma.BookNodeGetPayload<{
  include: { children: { include: { children: true } } };
}>;

/** تست همراه مبحث‌ها و علامت‌های کاربر. */
export type QuestionWithTopics = Prisma.QuestionGetPayload<{
  include: { bookNode: true; topics: { include: { topic: true } } };
}>;

/** تلاش ثبت‌شده همراه تست مربوطه (قاعدهٔ ۴: تاریخچه فقط افزودنی است). */
export type AttemptWithQuestion = Prisma.QuestionAttemptGetPayload<{
  include: { question: { include: { bookNode: true } } };
}>;

/** آزمون همراه شمار سؤال و اجراها. */
export type ExamWithCounts = Prisma.ExamGetPayload<{
  include: { _count: { select: { questions: true; attempts: true } } };
}>;

/** خلاصهٔ کارنامهٔ یک اجرای آزمون؛ در `ExamAttempt.scoreSummary` ذخیره می‌شود. */
export interface ExamScoreSummary {
  total: number;
  correct: number;
  wrong: number;
  unanswered: number;
  /** درصد = درست ÷ کل سؤال‌ها × ۱۰۰ */
  percent: number;
}

/** جمع‌بندی آماری که همیشه از رکوردهای خام ساخته می‌شود (قاعدهٔ ۷). */
export interface AttemptStats {
  total: number;
  correct: number;
  wrong: number;
  unanswered: number;
  accuracy: number | null;
  totalSeconds: number;
}

/** نتیجهٔ استاندارد همهٔ APIهای برنامه. */
export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string; fieldErrors?: Record<string, string> };

/** برای مستندسازی مقادیر متنی دامنه در تایپ‌های کمکی. */
export type DomainLiterals = {
  bookNodeType: BookNodeType;
  topicStatus: TopicStatus;
  attemptResult: AttemptResult;
  attemptSource: AttemptSource;
  taughtStatus: TaughtStatus;
  examType: ExamType;
  reviewReason: ReviewReason;
};
