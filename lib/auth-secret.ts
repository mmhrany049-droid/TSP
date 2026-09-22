/**
 * تعیین کلید امضای نشست (AUTH_SECRET) با رفتار مقاوم.
 *
 * این ماژول عمداً «خالص» است: نه `node:fs` را می‌خواند و نه به NextAuth و Prisma
 * وابسته است. چون میدل‌ور در محیط Edge اجرا می‌شود و دسترسی به فایل ندارد، منطق
 * انتخاب کلید باید همین‌جا و بدون وابستگی به سیستم فایل باشد.
 *
 * قاعده‌ها:
 *   ۱. اگر `AUTH_SECRET` تنظیم و به‌اندازهٔ کافی بلند باشد، همان استفاده می‌شود.
 *   ۲. اگر تنظیم نشده باشد و برنامه در حالت **تولید** باشد: کلید `undefined` است؛
 *      NextAuth خطای رسمی می‌دهد و `app/error.tsx` آن را به پیام فارسی تبدیل می‌کند.
 *      (در تولید هرگز از کلید پیش‌فرض استفاده نمی‌کنیم.)
 *   ۳. اگر تنظیم نشده باشد و برنامه در حالت **توسعه** باشد: یک کلید ثابت و موقت
 *      استفاده می‌شود تا برنامه بدون `.env` هم بالا بیاید.
 *
 * چرا کلید موقت «ثابت» است و تصادفی ساخته نمی‌شود؟
 *   چون میدل‌ور (Edge) و سرور (Node.js) دو محیط جدا هستند. اگر هر کدام کلید تازه‌ای
 *   می‌ساختند، کوکی نشستی که یکی می‌نوشت برای دیگری نامعتبر می‌شد و کاربر در حلقهٔ
 *   بی‌پایان ریدایرکت بین «/» و «/login» می‌افتاد. کلید ثابت توسعه این خطر را از
 *   بین می‌برد. این کلید فقط برای اجرای محلی است و در تولید قابل استفاده نیست.
 */

/** حداقل طول قابل‌قبول برای کلید امضای نشست. */
export const MIN_AUTH_SECRET_LENGTH = 16;

/**
 * کلید موقتِ حالت توسعه.
 *
 * این مقدار **محرمانه نیست** و فقط برای راحتی اجرای محلی است. هر برنامه‌ای که در
 * حالت تولید با این کلید اجرا شود ناامن است؛ به همین دلیل در تولید استفاده نمی‌شود.
 */
export const DEVELOPMENT_AUTH_SECRET = "tsp-development-only-secret-not-for-production";

/** نتیجهٔ بررسی کلید. */
export interface AuthSecretState {
  /** کلید مؤثر؛ در حالت تولید بدون تنظیم، `undefined` است. */
  secret: string | undefined;
  /** کلید از تنظیمات کاربر آمده است؟ */
  isConfigured: boolean;
  /** کلید موقت توسعه استفاده می‌شود؟ */
  isDevelopmentFallback: boolean;
  /** در حالت تولید کلید تنظیم نشده است (وضعیت بحرانی). */
  isMissingInProduction: boolean;
}

/** بررسی کلید تنظیم‌شده و تعیین وضعیت. */
export function resolveAuthSecretState(): AuthSecretState {
  const configured = process.env.AUTH_SECRET?.trim();
  const isConfigured = Boolean(configured && configured.length >= MIN_AUTH_SECRET_LENGTH);

  if (isConfigured) {
    return {
      secret: configured,
      isConfigured: true,
      isDevelopmentFallback: false,
      isMissingInProduction: false,
    };
  }

  if (process.env.NODE_ENV === "production") {
    return {
      secret: undefined,
      isConfigured: false,
      isDevelopmentFallback: false,
      isMissingInProduction: true,
    };
  }

  return {
    secret: DEVELOPMENT_AUTH_SECRET,
    isConfigured: false,
    isDevelopmentFallback: true,
    isMissingInProduction: false,
  };
}

/** کلید مؤثر برای NextAuth (و میدل‌ور). */
export function resolveAuthSecret(): string | undefined {
  return resolveAuthSecretState().secret;
}

let warningPrinted = false;

/**
 * یک‌بار در هر پردازش، اگر کلید تنظیم نشده باشد، هشدار فارسی چاپ می‌کند.
 *
 * هم در میدل‌ور (Edge) و هم در سرور (Node.js) کار می‌کند، چون هیچ وابستگی به
 * سیستم فایل ندارد.
 */
export function warnAboutAuthSecretOnce(): void {
  if (warningPrinted) {
    return;
  }

  const state = resolveAuthSecretState();

  if (state.isConfigured) {
    warningPrinted = true;
    return;
  }

  warningPrinted = true;

  if (state.isMissingInProduction) {
    console.error(
      [
        "",
        "✖ کلید AUTH_SECRET تنظیم نشده است.",
        "  در حالت تولید (production) استفاده از کلید موقت مجاز نیست، چون امنیت نشست‌ها را از بین می‌برد.",
        "  راه‌حل: در ریشهٔ پروژه فایل .env بسازید و این خط را به آن اضافه کنید:",
        '      AUTH_SECRET="یک-رشتهٔ-تصادفی-بلند"',
        "  ساخت مقدار تصادفی:  npm run init:env -- --force",
        "",
      ].join("\n"),
    );

    return;
  }

  console.warn(
    [
      "",
      "⚠ هشدار (فقط حالت توسعه): کلید AUTH_SECRET تنظیم نشده است.",
      "  برنامه با یک کلید موقت بالا می‌آید تا بتوانید کار کنید، اما با هر بار اجرا",
      "  از حساب خارج می‌شوید و این کلید برای محیط واقعی امن نیست.",
      "  راه‌حل: `npm run init:env` را اجرا کنید تا فایل .env با کلید تصادفی ساخته شود.",
      "",
    ].join("\n"),
  );
}
