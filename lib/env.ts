import fs from "node:fs";
import path from "node:path";

import {
  MIN_AUTH_SECRET_LENGTH,
  resolveAuthSecretState,
  warnAboutAuthSecretOnce,
} from "./auth-secret";
import { DEFAULT_DATABASE_URL, ENV_FILE_NAME, parseEnvFileContent } from "./env-parse";

export { DEFAULT_DATABASE_URL, MIN_AUTH_SECRET_LENGTH };

/**
 * مدیریت متغیرهای محیطی با رفتار مقاوم (فقط سمت سرور Node.js).
 *
 * هدف: برنامه هرگز به‌خاطر نبودِ `.env` کرش نکند و کاربر به‌جای صفحهٔ سفید، راهنمای
 * عملی ببیند.
 *
 *   ۱. متغیرهای فایل `.env` ریشهٔ پروژه پیش از هر چیز خوانده و «فقط اگر از قبل در
 *      محیط تعریف نشده باشند» در `process.env` گذاشته می‌شوند (اولویت با محیط واقعی).
 *      این کار عمداً با dotenv انجام نمی‌شود تا رفتار برنامه و اسکریپت‌های
 *      راه‌اندازی یکسان و قابل پیش‌بینی بماند.
 *   ۲. کلید `AUTH_SECRET` از ماژول «خالصِ» `lib/auth-secret.ts` می‌آید تا میدل‌ور
 *      (Edge) و سرور به یک نتیجه برسند و حلقهٔ ریدایرکت پیش نیاید.
 *   ۳. `getEnvStatus()` وضعیت را برای رابط کاربری و ابزار عیب‌یابی آماده می‌کند.
 *
 * نکته: این ماژول `node:fs` می‌خواهد، پس هرگز نباید در میدل‌ور (Edge) بار شود.
 */

/** وضعیت محیط برنامه؛ برای نمایش در رابط کاربری و ابزار عیب‌یابی. */
export interface EnvStatus {
  /** فایل `.env` پیدا و خوانده شد؟ */
  envFileExists: boolean;
  /** مسیر کامل فایل `.env`. */
  envFilePath: string;
  /** خطاهای قالب فایل `.env`. */
  envFileWarnings: string[];
  /** مقدار مؤثر `DATABASE_URL`. */
  databaseUrl: string;
  /** آدرس از فایل/محیط آمده یا مقدار پیش‌فرض است؟ */
  databaseUrlIsDefault: boolean;
  /** کلید امضای نشست به‌درستی تنظیم شده است؟ */
  hasAuthSecret: boolean;
  /** کلید موقت توسعه استفاده می‌شود؟ */
  authSecretIsFallback: boolean;
  /** در تولید کلید تنظیم نشده و برنامه اجازهٔ کار ندارد. */
  fatal: boolean;
  /** نیاز به نمایش راهنما در رابط کاربری دارد؟ */
  needsAttention: boolean;
  /** پیام‌های آمادهٔ نمایش (فارسی). */
  messages: string[];
  /** کارهایی که کاربر باید انجام دهد. */
  hints: string[];
  /** حالت اجرا. */
  isProduction: boolean;
}

let cachedStatus: EnvStatus | null = null;

/** خواندن فایل `.env` و تعریف متغیرهایش در `process.env` (فقط اگر تعریف نشده باشند). */
function loadEnvFileOnce(): { loaded: boolean; warnings: string[] } {
  const filePath = path.join(process.cwd(), ENV_FILE_NAME);

  if (!fs.existsSync(filePath)) {
    return { loaded: false, warnings: [] };
  }

  const { values, warnings } = parseEnvFileContent(fs.readFileSync(filePath, "utf8"));

  for (const [key, value] of Object.entries(values)) {
    if (!process.env[key]?.trim()) {
      process.env[key] = value;
    }
  }

  return { loaded: true, warnings };
}

/**
 * بررسی و آماده‌سازی محیط برنامه.
 *
 * این تابع idempotent است و در هر پردازش فقط یک‌بار واقعاً کار می‌کند.
 */
export function getEnvStatus(): EnvStatus {
  if (cachedStatus) {
    return cachedStatus;
  }

  const isProduction = process.env.NODE_ENV === "production";
  const { loaded, warnings } = loadEnvFileOnce();
  const messages: string[] = [];
  const hints: string[] = [];

  // ── پایگاه داده ──────────────────────────────────────────────────────────
  const databaseUrlFromEnv = process.env.DATABASE_URL?.trim();
  const databaseUrl = databaseUrlFromEnv || DEFAULT_DATABASE_URL;
  const databaseUrlIsDefault = !databaseUrlFromEnv;

  if (databaseUrlIsDefault) {
    process.env.DATABASE_URL = databaseUrl;
    messages.push("آدرس پایگاه داده در تنظیمات محیطی پیدا نشد؛ از مقدار پیش‌فرض پروژه استفاده می‌شود.");
  }

  // ── کلید امضای نشست ──────────────────────────────────────────────────────
  const secretState = resolveAuthSecretState();

  if (secretState.isMissingInProduction) {
    messages.push("کلید AUTH_SECRET تنظیم نشده است و در حالت تولید نمی‌توان از کلید موقت استفاده کرد.");
    hints.push(
      "در ریشهٔ پروژه فایل .env بسازید و این خط را به آن اضافه کنید:",
      'AUTH_SECRET="یک-رشتهٔ-تصادفی-بلند"',
      "ساخت مقدار تصادفی: npm run init:env -- --force",
    );
  } else if (secretState.isDevelopmentFallback) {
    messages.push("کلید AUTH_SECRET تنظیم نشده بود؛ برای اجرای محلی یک کلید موقت استفاده می‌شود.");
    hints.push(
      "با کلید موقت، با هر بار اجرای برنامه از حساب خارج می‌شوید (برای محیط واقعی امن نیست).",
      "برای تنظیم دائمی: npm run init:env",
    );
  }

  if (!loaded) {
    messages.push("فایل .env پیدا نشد.");
    hints.push(
      "برای ساخت فایل .env با مقادیر پیش‌فرض: npm run init:env",
      "یا کافی است دستور npm run dev:open را اجرا کنید؛ فایل خودکار ساخته می‌شود.",
    );
  }

  if (warnings.length > 0) {
    messages.push(...warnings);
    hints.push("قالب درست هر خط در .env این است: KEY=VALUE (بدون فاصله دور =).");
  }

  const fatal = secretState.isMissingInProduction;

  cachedStatus = {
    envFileExists: loaded,
    envFilePath: path.join(process.cwd(), ENV_FILE_NAME),
    envFileWarnings: warnings,
    databaseUrl,
    databaseUrlIsDefault,
    hasAuthSecret: secretState.isConfigured,
    authSecretIsFallback: secretState.isDevelopmentFallback,
    fatal,
    needsAttention: fatal || !secretState.isConfigured || !loaded || warnings.length > 0,
    messages,
    hints,
    isProduction,
  };

  return cachedStatus;
}

let diagnosticsPrinted = false;

/**
 * چاپ یک‌بارِ راهنمای محیط در کنسول سرور.
 *
 * هنگام اجرای `npm run dev`، کاربر بلافاصله در ترمینال می‌بیند که چه چیزی تنظیم
 * نشده و چه کاری باید بکند.
 */
export function logEnvDiagnostics(): void {
  if (diagnosticsPrinted) {
    return;
  }

  diagnosticsPrinted = true;

  warnAboutAuthSecretOnce();

  const status = getEnvStatus();

  if (status.messages.length === 0) {
    return;
  }

  console.warn(
    [
      "",
      "─── راهنمای تنظیمات محیطی TSP ───",
      ...status.messages.map((message) => `• ${message}`),
      ...status.hints.map((hint) => `  → ${hint}`),
      "",
    ].join("\n"),
  );
}

/** آدرس پایگاه داده (همیشه مقدار دارد). */
export function resolveDatabaseUrlEnv(): string {
  return getEnvStatus().databaseUrl;
}

/** فقط برای آزمون‌ها: پاک‌کردن حافظهٔ وضعیت محیط. */
export function resetEnvCache(): void {
  cachedStatus = null;
  diagnosticsPrinted = false;
}
