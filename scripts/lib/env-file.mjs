/**
 * ابزارهای کار با فایل `.env` — مشترک میان اسکریپت‌های پوشهٔ `scripts/`.
 *
 * چرا این ماژول جدا شده است؟
 *   چند اسکریپت (راه‌اندازی، آماده‌سازی، عیب‌یابی) باید بدانند «فایل .env هست یا نه»
 *   و در صورت نیاز آن را بسازند. جمع‌کردن این منطق در یک‌جا باعث می‌شود قالب فایل
 *   `.env` فقط یک‌جا تعریف شود و همهٔ اسکریپت‌ها یک رفتار داشته باشند.
 *
 * نکتهٔ مهم دربارهٔ قالب نوشته‌شده:
 *   مقادیر بدون فاصله دور `=` و بدون کامنت انتهای خط نوشته می‌شوند تا خوانندهٔ
 *   سادهٔ dotenv (و ابزارهای دیگر) آن‌ها را بدون ابهام بخواند.
 */
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

/** نام فایل متغیرهای محیطی. */
export const ENV_FILE_NAME = ".env";

/** نام فایل نمونهٔ متغیرهای محیطی. */
export const ENV_EXAMPLE_NAME = ".env.example";

/** آدرس پیش‌فرض پایگاه دادهٔ محلی (SQLite). */
export const DEFAULT_DATABASE_URL = "file:./prisma/dev.db";

/**
 * ساخت کلید تصادفی امن برای امضای نشست NextAuth.
 *
 * @returns {string}
 */
export function generateAuthSecret() {
  return randomBytes(32).toString("base64");
}

/**
 * متن کامل فایل `.env` برای پروژهٔ تازه.
 *
 * @returns {string}
 */
export function buildEnvFileContent() {
  return `# ---------------------------------------------------------------------------
# تنظیمات محیطی TSP (نسخهٔ ۰.۲)
# این فایل خودکار ساخته شده است؛ می‌توانید مقادیر را تغییر دهید.
# ---------------------------------------------------------------------------

# آدرس پایگاه دادهٔ محلی (SQLite). فایل در پوشهٔ prisma/ ساخته می‌شود.
DATABASE_URL="${DEFAULT_DATABASE_URL}"

# کلید امضای کوکی نشست (NextAuth). با هر بار ساخته‌شدن، مقدار تازه و تصادفی می‌گیرد.
# برای ساخت مقدار تازه:
#   node scripts/init-env.mjs --force
AUTH_SECRET="${generateAuthSecret()}"
`;
}

/**
 * خواندن یک فایل `.env` به شکل نگاشت «کلید → مقدار».
 *
 * فقط خطوط سادهٔ `KEY=VALUE` خوانده می‌شوند؛ مقادیر داخل نقل‌قول (تک یا جفت) بدون
 * نقل‌قول برگردانده می‌شوند. این خواننده عمداً ساده است و همان چیزی را می‌فهمد که
 * خودمان می‌نویسیم.
 *
 * @param {string} filePath
 * @returns {Record<string, string>}
 */
export function readEnvFile(filePath) {
  const values = {};

  if (!fs.existsSync(filePath)) {
    return values;
  }

  for (const rawLine of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");

    if (separatorIndex <= 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"') && value.length >= 2) ||
      (value.startsWith("'") && value.endsWith("'") && value.length >= 2)
    ) {
      value = value.slice(1, -1);
    }

    values[key] = value;
  }

  return values;
}

/**
 * نوشتن یا به‌روزرسانی یک متغیر در فایل `.env`.
 *
 * خطوط دیگر (توضیحات و متغیرهای موجود) دست‌نخورده می‌مانند. اگر کلید نبود، در
 * پایان فایل اضافه می‌شود.
 *
 * @param {string} filePath
 * @param {string} key
 * @param {string} value
 * @returns {boolean} آیا فایل تغییر کرد؟
 */
export function upsertEnvVariable(filePath, key, value) {
  const line = `${key}="${value}"`;
  const exists = fs.existsSync(filePath);
  const lines = exists ? fs.readFileSync(filePath, "utf8").split(/\r?\n/) : [];
  const pattern = new RegExp(`^\\s*${key}\\s*=`);

  for (let index = 0; index < lines.length; index += 1) {
    if (pattern.test(lines[index])) {
      if (lines[index] === line) {
        return false;
      }

      lines[index] = line;
      fs.writeFileSync(filePath, lines.join("\n"), "utf8");

      return true;
    }
  }

  const content = `${lines.join("\n").replace(/\n*$/, "")}${lines.length > 0 ? "\n" : ""}${line}\n`;

  fs.writeFileSync(filePath, content, "utf8");

  return true;
}

/**
 * اطلاعات فایل `.env` را می‌خواند و اگر نبود، از قالب پیش‌فرض می‌سازد.
 *
 * @param {{ projectRoot?: string, create?: boolean }} options
 * @returns {{ path: string, created: boolean, exists: boolean, values: Record<string, string>, missingAuthSecret: boolean, missingDatabaseUrl: boolean }}
 */
export function ensureEnvFile({ projectRoot = process.cwd(), create = true } = {}) {
  const filePath = path.join(projectRoot, ENV_FILE_NAME);
  const existed = fs.existsSync(filePath);

  if (!existed && create) {
    fs.writeFileSync(filePath, buildEnvFileContent(), "utf8");
  }

  const values = readEnvFile(filePath);

  return {
    path: filePath,
    created: !existed && create,
    exists: existed || create,
    values,
    missingAuthSecret: !values.AUTH_SECRET,
    missingDatabaseUrl: !values.DATABASE_URL,
  };
}

/**
 * اگر `AUTH_SECRET` در فایل نبود یا خالی بود، مقدار تازه‌ای می‌سازد.
 *
 * @param {string} [projectRoot]
 * @returns {{ changed: boolean, secret: string }}
 */
export function ensureAuthSecretInEnvFile(projectRoot = process.cwd()) {
  const filePath = path.join(projectRoot, ENV_FILE_NAME);
  const values = readEnvFile(filePath);

  if (values.AUTH_SECRET && values.AUTH_SECRET.trim().length >= 16) {
    return { changed: false, secret: values.AUTH_SECRET };
  }

  const secret = generateAuthSecret();

  upsertEnvVariable(filePath, "AUTH_SECRET", secret);

  return { changed: true, secret };
}
