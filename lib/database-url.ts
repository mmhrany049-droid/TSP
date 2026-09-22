import path from "node:path";

import { resolveDatabaseUrlEnv } from "./env";

/**
 * آدرس پایگاه داده را از متغیر محیطی `DATABASE_URL` می‌خواند و اگر مسیر نسبی بود،
 * آن را نسبت به ریشهٔ پروژه به مسیر مطلق تبدیل می‌کند.
 *
 * چرا؟ چون آداپتور libSQL مسیرهای نسبی را نسبت به پوشهٔ جاری (cwd) باز می‌کند و
 * این موضوع می‌تواند باعث ساخته‌شدن چند فایل پایگاه داده در مسیرهای مختلف شود.
 *
 * مقدار پیش‌فرض و خواندن فایل `.env` در `lib/env.ts` انجام می‌شود تا همهٔ بخش‌های
 * برنامه (برنامه، اسکریپت‌ها و میدل‌ور) یک رفتار داشته باشند.
 */
export function resolveDatabaseUrl(): string {
  const raw = resolveDatabaseUrlEnv();

  if (!raw.startsWith("file:")) {
    return raw;
  }

  const filePath = raw.slice("file:".length);

  return path.isAbsolute(filePath) ? raw : `file:${path.resolve(process.cwd(), filePath)}`;
}

/** مسیر فایل پایگاه دادهٔ محلی (فقط برای SQLite؛ در غیر این صورت `null`). */
export function resolveDatabaseFilePath(): string | null {
  const url = resolveDatabaseUrl();

  return url.startsWith("file:") ? url.slice("file:".length) : null;
}
