/**
 * تجزیهٔ سادهٔ محتوای فایل `.env`.
 *
 * این ماژول عمداً «خالص» و بدون هیچ وابستگی است (نه `node:fs`، نه ماژول داخلی دیگر)
 * تا هم در سرور قابل استفاده باشد و هم به‌سادگی آزمون واحد شود.
 *
 * چرا خودمان تجزیه می‌کنیم و از dotenv استفاده نمی‌کنیم؟
 *   چون می‌خواهیم رفتار برنامه و اسکریپت‌های راه‌اندازی (پوشهٔ `scripts/`) دقیقاً
 *   یکی باشد و خطاهای قالب (مثلاً فاصله دور `=`) به پیام فارسی تبدیل شوند.
 */

/** نام فایل تنظیمات محیطی. */
export const ENV_FILE_NAME = ".env";

/** آدرس پیش‌فرض پایگاه دادهٔ محلی (SQLite). */
export const DEFAULT_DATABASE_URL = "file:./prisma/dev.db";

/** نتیجهٔ تجزیهٔ فایل `.env`. */
export interface ParsedEnvFile {
  values: Record<string, string>;
  /** خط‌های نامعتبر (مثلاً فاصله دور `=`) برای پیام راهنما. */
  warnings: string[];
}

/** خواندن خطوط `KEY=VALUE` از متن یک فایل `.env`. */
export function parseEnvFileContent(content: string): ParsedEnvFile {
  const values: Record<string, string> = {};
  const warnings: string[] = [];
  const lines = content.split(/\r?\n/);

  for (const [index, rawLine] of lines.entries()) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");

    if (separatorIndex <= 0) {
      warnings.push(`خط ${index + 1} فایل .env قالب درست «KEY=VALUE» را ندارد.`);
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();

    if (/\s/.test(key)) {
      warnings.push(`نام متغیر در خط ${index + 1} فایل .env فاصله دارد و نادیده گرفته شد.`);
      continue;
    }

    if (
      (value.startsWith('"') && value.endsWith('"') && value.length >= 2) ||
      (value.startsWith("'") && value.endsWith("'") && value.length >= 2)
    ) {
      value = value.slice(1, -1);
    }

    values[key] = value;
  }

  return { values, warnings };
}
