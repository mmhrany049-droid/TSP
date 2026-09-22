import type { Book, BookNode, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { BadRequestError, ConflictError, NotFoundError } from "@/lib/services/errors";
import { sortNodes } from "@/lib/tree";
import type { BookInput, BookNodeInput } from "@/lib/validations";

/**
 * منطق ماژول «مدیریت کتاب» (LibraryManager).
 *
 * قاعده‌های امنیتی که همه‌جا رعایت می‌شوند:
 *   ۱. هر پرس‌وجو با `userId` محدود می‌شود؛ کاربر هرگز کتاب دیگری را نمی‌بیند.
 *   ۲. برای کار روی گره‌ها، ابتدا تعلق کتاب به کاربر بررسی می‌شود.
 *   ۳. خطاهای «پیدا نشد» از نوع `NotFoundError` هستند تا API کد ۴۰۴ بدهد.
 *
 * آمارها از رکوردهای خام محاسبه می‌شوند (قاعدهٔ ۷ سند مدل داده) و هیچ فیلد خلاصه‌ای
 * ذخیره نمی‌شود.
 */

/** کتاب همراه تعداد گره‌ها و تست‌ها (برای فهرست کتاب‌ها). */
export type BookWithCounts = Prisma.BookGetPayload<{
  include: { _count: { select: { nodes: true; questions: true } } };
}>;

/** گره ساختار کتاب همراه تعداد تست‌های همان گره. */
export type BookNodeWithCount = Prisma.BookNodeGetPayload<{
  include: { _count: { select: { questions: true } } };
}>;

/** جزئیات کامل یک کتاب: خود کتاب + گره‌ها + آمار. */
export interface BookDetail {
  book: Book;
  nodes: BookNodeWithCount[];
  stats: {
    nodeCount: number;
    questionCount: number;
    importantCount: number;
    hardCount: number;
    publisherHardCount: number;
    inactiveCount: number;
  };
}

/** آمار کلی کتابخانهٔ کاربر (برای کارت‌های بالای صفحه). */
export interface LibrarySummary {
  bookCount: number;
  nodeCount: number;
  questionCount: number;
  importantCount: number;
  hardCount: number;
  bySubject: Array<{ subject: string; bookCount: number; questionCount: number }>;
}

/**
 * کتاب‌ها همراه گره‌های ساختار — برای فرم‌های انتخاب کتاب و محل تست.
 *
 * فقط فیلدهای لازم برای فهرست‌های کشویی خوانده می‌شود تا پاسخ سبک بماند.
 */
export async function listBookOptionsForForms(userId: string): Promise<
  Array<{
    id: string;
    title: string;
    subject: string;
    nodes: Array<{ id: string; parentId: string | null; title: string; nodeType: string; orderIndex: number }>;
  }>
> {
  const books = await prisma.book.findMany({
    where: { userId },
    orderBy: [{ createdAt: "desc" }],
    select: {
      id: true,
      title: true,
      subject: true,
      nodes: {
        select: { id: true, parentId: true, title: true, nodeType: true, orderIndex: true },
        orderBy: [{ orderIndex: "asc" }, { title: "asc" }],
      },
    },
  });

  return books;
}

/** فهرست کتاب‌های کاربر، تازه‌ترین‌ها اول. */
export function listBooks(userId: string): Promise<BookWithCounts[]> {
  return prisma.book.findMany({
    where: { userId },
    include: { _count: { select: { nodes: true, questions: true } } },
    orderBy: [{ createdAt: "desc" }],
  });
}

/** آمار کلی کتابخانه: کتاب‌ها، گره‌ها، تست‌ها و علامت‌ها. */
export async function getLibrarySummary(userId: string): Promise<LibrarySummary> {
  const [bookCount, nodeCount, questionCount, importantCount, hardCount, grouped] = await Promise.all([
    prisma.book.count({ where: { userId } }),
    prisma.bookNode.count({ where: { book: { userId } } }),
    prisma.question.count({ where: { book: { userId } } }),
    prisma.question.count({ where: { book: { userId }, isImportant: true } }),
    prisma.question.count({ where: { book: { userId }, isHard: true } }),
    prisma.book.groupBy({
      by: ["subject"],
      where: { userId },
      _count: { _all: true },
      orderBy: { subject: "asc" },
    }),
  ]);

  const questionsBySubject = await prisma.question.groupBy({
    by: ["bookId"],
    where: { book: { userId } },
    _count: { _all: true },
  });

  const books = await prisma.book.findMany({ where: { userId }, select: { id: true, subject: true } });
  const subjectOfBook = new Map(books.map((book) => [book.id, book.subject]));
  const questionsPerSubject = new Map<string, number>();

  for (const row of questionsBySubject) {
    const subject = subjectOfBook.get(row.bookId);

    if (subject) {
      questionsPerSubject.set(subject, (questionsPerSubject.get(subject) ?? 0) + row._count._all);
    }
  }

  return {
    bookCount,
    nodeCount,
    questionCount,
    importantCount,
    hardCount,
    bySubject: grouped.map((row) => ({
      subject: row.subject,
      bookCount: row._count._all,
      questionCount: questionsPerSubject.get(row.subject) ?? 0,
    })),
  };
}

/** یک کتاب با بررسی تعلق به کاربر. */
export async function requireBook(bookId: string, userId: string): Promise<Book> {
  const book = await prisma.book.findFirst({ where: { id: bookId, userId } });

  if (!book) {
    throw new NotFoundError("کتاب موردنظر پیدا نشد یا به حساب شما تعلق ندارد.");
  }

  return book;
}

/** جزئیات کتاب همراه گره‌ها و آمار. */
export async function getBookDetail(bookId: string, userId: string): Promise<BookDetail> {
  const book = await requireBook(bookId, userId);

  const [nodes, questionStats] = await Promise.all([
    prisma.bookNode.findMany({
      where: { bookId },
      include: { _count: { select: { questions: true } } },
    }),
    prisma.question.aggregate({
      where: { bookId },
      _count: { _all: true },
    }),
  ]);

  const [importantCount, hardCount, publisherHardCount, inactiveCount] = await Promise.all([
    prisma.question.count({ where: { bookId, isImportant: true } }),
    prisma.question.count({ where: { bookId, isHard: true } }),
    prisma.question.count({ where: { bookId, publisherDifficulty: "hard" } }),
    prisma.question.count({ where: { bookId, isActive: false } }),
  ]);

  return {
    book,
    nodes: sortNodes(nodes),
    stats: {
      nodeCount: nodes.length,
      questionCount: questionStats._count._all,
      importantCount,
      hardCount,
      publisherHardCount,
      inactiveCount,
    },
  };
}

/** ساخت کتاب تازه برای کاربر. */
export function createBook(userId: string, input: BookInput): Promise<Book> {
  return prisma.book.create({
    data: {
      userId,
      title: input.title,
      subject: input.subject,
      publisher: input.publisher ?? null,
      grade: input.grade ?? null,
      field: input.field ?? null,
      notes: input.notes ?? null,
    },
  });
}

/** ویرایش ویژگی‌های کتاب (نه ساختار آن). */
export async function updateBook(bookId: string, userId: string, input: BookInput): Promise<Book> {
  await requireBook(bookId, userId);

  return prisma.book.update({
    where: { id: bookId },
    data: {
      title: input.title,
      subject: input.subject,
      publisher: input.publisher ?? null,
      grade: input.grade ?? null,
      field: input.field ?? null,
      notes: input.notes ?? null,
    },
  });
}

/**
 * حذف کتاب همراه همهٔ ساختار و تست‌هایش.
 *
 * چون `onDelete: Cascade` در schema تعریف شده، خودِ پایگاه داده گره‌ها، تست‌ها،
 * تلاش‌ها و موارد وابسته را پاک می‌کند. تعداد موارد حذف‌شده برگردانده می‌شود تا
 * پیام تأیید دقیق باشد.
 */
export async function deleteBook(
  bookId: string,
  userId: string,
): Promise<{ title: string; questionCount: number; nodeCount: number }> {
  const book = await requireBook(bookId, userId);

  const [questionCount, nodeCount] = await Promise.all([
    prisma.question.count({ where: { bookId } }),
    prisma.bookNode.count({ where: { bookId } }),
  ]);

  await prisma.book.delete({ where: { id: bookId } });

  return { title: book.title, questionCount, nodeCount };
}

// ---------------------------------------------------------------------------
// ساختار کتاب (BookNode)
// ---------------------------------------------------------------------------

/** فهرست گره‌های یک کتاب (مرتب‌شده). */
export async function listBookNodes(bookId: string, userId: string): Promise<BookNodeWithCount[]> {
  await requireBook(bookId, userId);

  const nodes = await prisma.bookNode.findMany({
    where: { bookId },
    include: { _count: { select: { questions: true } } },
  });

  return sortNodes(nodes);
}

/**
 * افزودن گرهٔ تازه به ساختار کتاب.
 *
 * اگر والد داده شده باشد، باید به همین کتاب تعلق داشته باشد (جلوگیری از ساختن
 * درخت میان دو کتاب).
 */
export async function createBookNode(
  bookId: string,
  userId: string,
  input: BookNodeInput,
): Promise<BookNode> {
  await requireBook(bookId, userId);

  if (input.parentId) {
    const parent = await prisma.bookNode.findFirst({
      where: { id: input.parentId, bookId },
      select: { id: true },
    });

    if (!parent) {
      throw new BadRequestError("گرهٔ والد انتخاب‌شده در این کتاب پیدا نشد.");
    }
  }

  return prisma.bookNode.create({
    data: {
      bookId,
      parentId: input.parentId ?? null,
      nodeType: input.nodeType,
      title: input.title,
      orderIndex: input.orderIndex,
    },
  });
}

/** ویرایش گرهٔ ساختار کتاب (عنوان، نوع، ترتیب یا جابه‌جایی نزدیک‌ترین هم‌سطح). */
export async function updateBookNode(
  nodeId: string,
  userId: string,
  input: Partial<BookNodeInput> & { move?: "up" | "down" },
): Promise<BookNode> {
  const node = await prisma.bookNode.findFirst({
    where: { id: nodeId, book: { userId } },
  });

  if (!node) {
    throw new NotFoundError("فصل یا بخش موردنظر پیدا نشد.");
  }

  if (input.move) {
    const moved = await moveNodeAmongSiblings(node, input.move);

    if (!moved) {
      throw new ConflictError(
        input.move === "up" ? "این مورد اولین گزینه است." : "این مورد آخرین گزینه است.",
      );
    }
  }

  return prisma.bookNode.update({
    where: { id: nodeId },
    data: {
      title: input.title ?? undefined,
      nodeType: input.nodeType ?? undefined,
      orderIndex: input.orderIndex ?? undefined,
      parentId: input.parentId === undefined ? undefined : (input.parentId ?? null),
    },
  });
}

/**
 * جابه‌جایی گره با هم‌سطح قبلی/بعدی.
 *
 * چرا «شماره‌گذاری مجدد» به‌جای جابه‌کردن دو عدد؟ چون کاربر معمولاً ترتیب را دستی
 * وارد نمی‌کند و همهٔ گره‌ها `orderIndex = 0` می‌گیرند؛ در آن حالت جابه‌کردن دو
 * مقدار برابر هیچ اثری ندارد. پس هم‌سطح‌ها به ترتیب فعلی مرتب و از صفر شماره‌گذاری
 * مجدد می‌شوند؛ این کار داده‌های ناهم‌ترتیب را هم خودبه‌خود درست می‌کند.
 *
 * اگر گره اولین/آخرین هم‌سطح‌ها باشد `false` برمی‌گردد تا سرویس خطای ۴۰۹ بدهد
 * (به‌جای اینکه بی‌صدا چیزی تغییر کند).
 */
async function moveNodeAmongSiblings(node: BookNode, direction: "up" | "down"): Promise<boolean> {
  const siblings = sortNodes(
    await prisma.bookNode.findMany({
      where: { bookId: node.bookId, parentId: node.parentId },
    }),
  );

  const index = siblings.findIndex((sibling) => sibling.id === node.id);
  const targetIndex = direction === "up" ? index - 1 : index + 1;

  if (index === -1 || targetIndex < 0 || targetIndex >= siblings.length) {
    return false;
  }

  const reordered = [...siblings];
  [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];

  await prisma.$transaction(
    reordered.map((sibling, position) =>
      prisma.bookNode.update({ where: { id: sibling.id }, data: { orderIndex: position } }),
    ),
  );

  return true;
}

/**
 * حذف گره و همهٔ زیرگره‌هایش.
 *
 * تعداد تست‌هایی که با حذف از بین می‌روند هم برگردانده می‌شود تا رابط کاربری
 * بتواند پیش از حذف هشدار دقیق بدهد.
 */
export async function deleteBookNode(
  nodeId: string,
  userId: string,
): Promise<{ title: string; removedNodeCount: number; removedQuestionCount: number }> {
  const node = await prisma.bookNode.findFirst({ where: { id: nodeId, book: { userId } } });

  if (!node) {
    throw new NotFoundError("فصل یا بخش موردنظر پیدا نشد.");
  }

  const subtreeIds = await collectSubtreeIds(nodeId);

  const removedQuestionCount = await prisma.question.count({ where: { bookNodeId: { in: subtreeIds } } });

  await prisma.bookNode.delete({ where: { id: nodeId } });

  return {
    title: node.title,
    removedNodeCount: subtreeIds.length,
    removedQuestionCount,
  };
}

/** شناسهٔ یک گره و همهٔ زیرگره‌هایش (برای حذف و آمار). */
async function collectSubtreeIds(rootId: string): Promise<string[]> {
  const ids = [rootId];
  let frontier = [rootId];

  // پیمایش سطح‌به‌سطح تا کل زیردرخت پیدا شود.
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

/** آمار تست‌های هر گره (برای نمایش کنار هر فصل/بخش در درخت). */
export async function countQuestionsByNode(bookId: string): Promise<Map<string, number>> {
  const rows = await prisma.question.groupBy({
    by: ["bookNodeId"],
    where: { bookId },
    _count: { _all: true },
  });

  return new Map(rows.map((row) => [row.bookNodeId, row._count._all]));
}
