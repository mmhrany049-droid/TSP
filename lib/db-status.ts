import fs from "node:fs";

import { resolveDatabaseFilePath } from "./database-url";
import { getEnvStatus } from "./env";
import { prisma } from "./prisma";

/**
 * وضعیت پایگاه داده برای رابط کاربری.
 *
 * چرا لازم است؟ اگر کاربر `npm run db:setup` را اجرا نکرده باشد، صفحهٔ ورود نباید
 * «صفحهٔ سفید» یا خطای مبهم نشان دهد؛ باید بگوید چه چیزی کم است و چه دستوری باید
 * اجرا شود. این ماژول همان بررسی را انجام می‌دهد و پیام فارسی آماده می‌سازد.
 *
 * هزینهٔ این بررسی یک پرس‌وجوی سبک است و نتیجه‌اش در حافظهٔ پردازش نگه داشته
 * می‌شود تا در هر درخواست تکرار نشود.
 */

/** جدول‌های کلیدی که وجودشان نشانهٔ آماده بودن پایگاه داده است. */
const REQUIRED_TABLES = ["User", "Book", "Question", "QuestionAttempt"] as const;

export type DatabaseState = "ready" | "missing" | "error";

export interface DatabaseStatus {
  state: DatabaseState;
  /** آیا فایل پایگاه دادهٔ محلی موجود است؟ */
  fileExists: boolean;
  /** مسیر فایل پایگاه داده (برای SQLite). */
  filePath: string | null;
  /** پیام فارسی وضعیت. */
  message: string;
  /** کاری که کاربر باید انجام دهد. */
  hint: string;
}

const SETUP_HINT = "دستور `npm run db:setup` را در پوشهٔ پروژه اجرا کنید، سپس `npm run dev:open`.";

/** فهرست جدول‌های موجود را از خود پایگاه داده می‌خواند (یک پرس‌وجوی سبک). */
async function listExistingTables(): Promise<string[]> {
  const rows = await prisma.$queryRawUnsafe<Array<{ name: string }>>(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'",
  );

  return rows.map((row) => String(row.name));
}

/**
 * نتیجهٔ آخرین بررسی؛ برای پرهیز از تکرار پرس‌وجو در درخواست‌های پیاپی.
 *
 * حافظه «تازه» است: با گذشت چند ثانیه باطل می‌شود تا اگر کاربر در همین حین
 * `npm run db:setup` را اجرا کرد، برنامه بدون راه‌اندازی دوباره متوجه شود.
 */
const STATUS_CACHE_TTL_MS = 10_000;

let cachedStatus: { status: DatabaseStatus; at: number } | null = null;

/**
 * بررسی می‌کند فایل پایگاه داده و جدول‌های اصلی آماده‌اند یا نه.
 *
 * @param options.fresh اگر `true` باشد، حافظهٔ نتیجه نادیده گرفته می‌شود.
 */
export async function getDatabaseStatus(options: { fresh?: boolean } = {}): Promise<DatabaseStatus> {
  if (!options.fresh && cachedStatus && Date.now() - cachedStatus.at < STATUS_CACHE_TTL_MS) {
    return cachedStatus.status;
  }

  const filePath = resolveDatabaseFilePath();
  const fileExists = filePath ? fs.existsSync(filePath) : true;

  const finish = (status: DatabaseStatus): DatabaseStatus => {
    cachedStatus = { status, at: Date.now() };

    return status;
  };

  if (!fileExists) {
    return finish({
      state: "missing",
      fileExists: false,
      filePath,
      message: "پایگاه دادهٔ محلی (فایل SQLite) ساخته نشده است.",
      hint: SETUP_HINT,
    });
  }

  try {
    const tables = await listExistingTables();
    const missingTables = REQUIRED_TABLES.filter((table) => !tables.includes(table));

    if (missingTables.length > 0) {
      return finish({
        state: "missing",
        fileExists,
        filePath,
        message:
          tables.length === 0
            ? "پایگاه داده خالی است و هیچ جدولی ندارد."
            : `ساختار پایگاه داده ناقص است (غایب: ${missingTables.join(", ")}).`,
        hint: SETUP_HINT,
      });
    }

    return finish({
      state: "ready",
      fileExists,
      filePath,
      message: "پایگاه داده آماده است.",
      hint: "",
    });
  } catch (error) {
    const rawMessage = error instanceof Error ? error.message : String(error);
    const isMissingFile = /unable to open database file|ENOENT|no such file|SQLITE_CANTOPEN/i.test(rawMessage);

    return finish({
      state: "error",
      fileExists,
      filePath,
      message: isMissingFile
        ? "فایل پایگاه داده پیدا نشد."
        : "اتصال به پایگاه داده برقرار نشد.",
      hint: `${SETUP_HINT} اگر مشکل ادامه داشت، \`npm run doctor\` را اجرا کنید.`,
    });
  }
}

/** پاک‌کردن حافظهٔ وضعیت (پس از ساخت پایگاه داده در همان پردازش). */
export function resetDatabaseStatusCache(): void {
  cachedStatus = null;
}

/** آیا برنامه به‌خاطر نبودِ تنظیمات محیطی نمی‌تواند کار کند؟ */
export function hasFatalEnvProblem(): boolean {
  return getEnvStatus().fatal;
}
