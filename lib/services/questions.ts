import type { Prisma, Question } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { BadRequestError, NotFoundError } from "@/lib/services/errors";
import { requireBook } from "@/lib/services/books";
import type { QuestionInput, QuestionPatchInput } from "@/lib/validations";

/**
 * منطق ماژول «بانک تست» (QuestionBank).
 *
 * قاعده‌های کلیدی سند مدل داده که اینجا رعایت می‌شوند:
 *   • شناسهٔ داخلی یکتا همان `id` است (خودکار ساخته می‌شود) و `displayNumber` فقط
 *     شمارهٔ نمایشی است و **یکتا نیست**.
 *   • هر تست باید به یک گرهٔ کتاب (`bookNodeId`) وصل باشد؛ تست بی‌محل معنا ندارد.
 *   • `isImportant`، `isHard` و `publisherDifficulty` سه مفهوم جدا هستند.
 *   • حذف «نرم» است: `isActive = false` تا تاریخچهٔ تلاش‌ها از بین نرود.
 */

/** یک تست همراه اطلاعات کتاب و محل آن در ساختار. */
export type QuestionWithContext = Prisma.QuestionGetPayload<{
  include: {
    book: { select: { id: true; title: true; subject: true } };
    bookNode: { select: { id: true; title: true; nodeType: true; parentId: true } };
    _count: { select: { attempts: true } };
  };
}>;

/** فیلترهای فهرست تست‌ها. */
export interface QuestionFilters {
  bookId?: string;
  bookNodeId?: string;
  /** چند گره با هم (برای دیدن تست‌های یک فصل و زیربخش‌هایش). */
  bookNodeIds?: string[];
  /** آیا تست‌های بایگانی‌شده هم دیده شوند؟ */
  includeInactive?: boolean;
  /** فقط مهم‌ها / فقط غیرمهم‌ها */
  important?: boolean;
  /** فقط سخت‌ها / فقط غیرسخت‌ها */
  hard?: boolean;
  publisherDifficulty?: "easy" | "medium" | "hard";
  /** جست‌وجو در شمارهٔ نمایشی */
  search?: string;
  page?: number;
  perPage?: number;
}

/** نتیجهٔ صفحه‌بندی‌شدهٔ فهرست تست‌ها. */
export interface PaginatedQuestions {
  items: QuestionWithContext[];
  total: number;
  page: number;
  perPage: number;
  pageCount: number;
}

const DEFAULT_PER_PAGE = 20;
const MAX_PER_PAGE = 100;

/** تبدیل فیلترها به شرط Prisma (همیشه محدود به کاربر). */
function buildWhere(userId: string, filters: QuestionFilters): Prisma.QuestionWhereInput {
  const where: Prisma.QuestionWhereInput = { book: { userId } };

  if (filters.bookId) {
    where.bookId = filters.bookId;
  }

  if (filters.bookNodeId) {
    where.bookNodeId = filters.bookNodeId;
  }

  if (filters.bookNodeIds && filters.bookNodeIds.length > 0) {
    where.bookNodeId = { in: filters.bookNodeIds };
  }

  if (!filters.includeInactive) {
    where.isActive = true;
  }

  if (filters.important !== undefined) {
    where.isImportant = filters.important;
  }

  if (filters.hard !== undefined) {
    where.isHard = filters.hard;
  }

  if (filters.publisherDifficulty) {
    where.publisherDifficulty = filters.publisherDifficulty;
  }

  const search = filters.search?.trim();

  if (search) {
    // جست‌وجوی ساده روی شمارهٔ نمایشی؛ SQLite در Prisma از حالت «بزرگ/کوچک» بی‌تفاوت
    // برای متن فارسی پشتیبانی کامل ندارد، پس همان `contains` کافی است.
    where.displayNumber = { contains: search };
  }

  return where;
}

/** فهرست تست‌ها با فیلتر و صفحه‌بندی. */
export async function listQuestions(
  userId: string,
  filters: QuestionFilters = {},
): Promise<PaginatedQuestions> {
  const perPage = Math.min(Math.max(filters.perPage ?? DEFAULT_PER_PAGE, 1), MAX_PER_PAGE);
  const requestedPage = Math.max(filters.page ?? 1, 1);
  const where = buildWhere(userId, filters);

  const total = await prisma.question.count({ where });
  const pageCount = Math.max(Math.ceil(total / perPage), 1);
  const page = Math.min(requestedPage, pageCount);

  const items = await prisma.question.findMany({
    where,
    include: {
      book: { select: { id: true, title: true, subject: true } },
      bookNode: { select: { id: true, title: true, nodeType: true, parentId: true } },
      _count: { select: { attempts: true } },
    },
    orderBy: [{ createdAt: "desc" }, { displayNumber: "asc" }],
    skip: (page - 1) * perPage,
    take: perPage,
  });

  return { items, total, page, perPage, pageCount };
}

/** یک تست با بررسی تعلق به کاربر. */
export async function requireQuestion(questionId: string, userId: string): Promise<Question> {
  const question = await prisma.question.findFirst({
    where: { id: questionId, book: { userId } },
  });

  if (!question) {
    throw new NotFoundError("تست موردنظر پیدا نشد یا به حساب شما تعلق ندارد.");
  }

  return question;
}

/** جزئیات یک تست همراه کتاب، محل و تعداد تلاش‌ها. */
export function getQuestionDetail(
  questionId: string,
  userId: string,
): Promise<QuestionWithContext | null> {
  return prisma.question.findFirst({
    where: { id: questionId, book: { userId } },
    include: {
      book: { select: { id: true, title: true, subject: true } },
      bookNode: { select: { id: true, title: true, nodeType: true, parentId: true } },
      _count: { select: { attempts: true } },
    },
  });
}

/**
 * ثبت تست تازه.
 *
 * پیش از ساخت، بررسی می‌شود که کتاب و گرهٔ انتخابی **به همین کاربر** تعلق داشته
 * باشند و گره داخل همان کتاب باشد.
 */
export async function createQuestion(userId: string, input: QuestionInput): Promise<Question> {
  await requireBook(input.bookId, userId);

  const node = await prisma.bookNode.findFirst({
    where: { id: input.bookNodeId, bookId: input.bookId },
    select: { id: true },
  });

  if (!node) {
    throw new BadRequestError("بخش انتخاب‌شده در این کتاب پیدا نشد.");
  }

  return prisma.question.create({
    data: {
      bookId: input.bookId,
      bookNodeId: input.bookNodeId,
      displayNumber: input.displayNumber,
      correctAnswer: input.correctAnswer,
      publisherDifficulty: input.publisherDifficulty ?? null,
      isImportant: input.isImportant ?? false,
      isHard: input.isHard ?? false,
    },
  });
}

/** ویرایش تست؛ فقط فیلدهایی که فرستاده شده‌اند تغییر می‌کنند. */
export async function updateQuestion(
  questionId: string,
  userId: string,
  input: QuestionPatchInput,
): Promise<Question> {
  const question = await requireQuestion(questionId, userId);

  // اگر محل تست تغییر کند، گرهٔ تازه باید داخل همان کتاب باشد.
  if (input.bookNodeId) {
    const node = await prisma.bookNode.findFirst({
      where: { id: input.bookNodeId, bookId: question.bookId },
      select: { id: true },
    });

    if (!node) {
      throw new BadRequestError("بخش انتخاب‌شده در این کتاب پیدا نشد.");
    }
  }

  return prisma.question.update({
    where: { id: questionId },
    data: {
      displayNumber: input.displayNumber ?? undefined,
      correctAnswer: input.correctAnswer ?? undefined,
      // در این فیلد `null` یعنی «پاک کن»؛ پس نباید با `undefined` قاطی شود.
      publisherDifficulty: input.publisherDifficulty === undefined ? undefined : input.publisherDifficulty,
      isImportant: input.isImportant ?? undefined,
      isHard: input.isHard ?? undefined,
      isActive: input.isActive ?? undefined,
      bookNodeId: input.bookNodeId ?? undefined,
    },
  });
}

/** بایگانی نرم تست (به‌جای حذف کامل). */
export async function setQuestionActive(
  questionId: string,
  userId: string,
  isActive: boolean,
): Promise<Question> {
  await requireQuestion(questionId, userId);

  return prisma.question.update({ where: { id: questionId }, data: { isActive } });
}

/**
 * تغییر یک علامت (مهم/سخت) — پرکاربردترین کار در بانک تست.
 */
export async function toggleQuestionFlag(
  questionId: string,
  userId: string,
  flag: "isImportant" | "isHard",
  value: boolean,
): Promise<Question> {
  await requireQuestion(questionId, userId);

  return prisma.question.update({ where: { id: questionId }, data: { [flag]: value } });
}

/**
 * حذف کامل تست.
 *
 * به‌طور پیش‌فرض از API استفاده نمی‌شود (بایگانی امن‌تر است)، اما برای پاک‌کردن
 * تست‌های اشتباه لازم است. تلاش‌های ثبت‌شده هم با آن پاک می‌شوند (Cascade).
 */
export async function deleteQuestion(
  questionId: string,
  userId: string,
): Promise<{ displayNumber: string; attemptCount: number }> {
  const question = await requireQuestion(questionId, userId);

  const attemptCount = await prisma.questionAttempt.count({ where: { questionId } });

  await prisma.question.delete({ where: { id: questionId } });

  return { displayNumber: question.displayNumber, attemptCount };
}

/** آمار بانک تست کاربر (برای کارت‌های بالای صفحه و داشبورد). */
export async function getQuestionBankSummary(userId: string): Promise<{
  total: number;
  important: number;
  hard: number;
  publisherHard: number;
  archived: number;
  withAttempts: number;
}> {
  const base = { book: { userId } } as const;

  const [total, important, hard, publisherHard, archived, withAttempts] = await Promise.all([
    prisma.question.count({ where: { ...base, isActive: true } }),
    prisma.question.count({ where: { ...base, isActive: true, isImportant: true } }),
    prisma.question.count({ where: { ...base, isActive: true, isHard: true } }),
    prisma.question.count({ where: { ...base, isActive: true, publisherDifficulty: "hard" } }),
    prisma.question.count({ where: { ...base, isActive: false } }),
    prisma.question.count({ where: { ...base, attempts: { some: {} } } }),
  ]);

  return { total, important, hard, publisherHard, archived, withAttempts };
}

/**
 * فهرست تست‌های یک گره با احتساب زیرگره‌ها.
 *
 * در بانک تست، وقتی کاربر روی یک فصل کلیک می‌کند انتظار دارد تست‌های همهٔ
 * بخش‌های درون آن فصل را هم ببیند.
 */
export async function listQuestionsInSubtree(
  userId: string,
  bookId: string,
  rootNodeId: string,
): Promise<QuestionWithContext[]> {
  await requireBook(bookId, userId);

  const nodeIds = await collectSubtreeNodeIds(rootNodeId);
  const { items } = await listQuestions(userId, {
    bookId,
    bookNodeIds: nodeIds,
    perPage: MAX_PER_PAGE,
  });

  return items;
}

/** شناسهٔ یک گره و همهٔ زیرگره‌هایش. */
async function collectSubtreeNodeIds(rootId: string): Promise<string[]> {
  const ids = [rootId];
  let frontier = [rootId];

  while (frontier.length > 0) {
    const children = await prisma.bookNode.findMany({
      where: { parentId: { in: frontier } },
      select: { id: true },
    });

    frontier = children.map((child) => child.id);

    if (frontier.length > 0) {
      ids.push(...frontier);
    }
  }

  return ids;
}
