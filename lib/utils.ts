import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * ترکیب کلاس‌های Tailwind با حل تعارض‌ها.
 *
 * ```tsx
 * <div className={cn("p-2", isActive && "bg-blue-500", className)} />
 * ```
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** دامنهٔ ساختگی برای تجزیهٔ مسیرهای نسبی در `safeCallbackUrl`. */
const RELATIVE_BASE = "http://tsp.local";

/**
 * پاک‌سازی مقصد بازگشت پس از ورود (`callbackUrl`).
 *
 * این مقدار از آدرس صفحه می‌آید و کاربر می‌تواند دستکاری‌اش کند، پس هرگز نباید
 * خام مصرف شود («حملهٔ بازگردانی باز»). قاعده: همیشه یک مسیر روی دامنهٔ خودمان
 * برگردانده می‌شود و دامنهٔ بیرونی حذف می‌شود. چون NextAuth خودش `callbackUrl`
 * را به شکل آدرس مطلق می‌سازد، مسیرِ آدرس مطلق هم پذیرفته می‌شود.
 */
export function safeCallbackUrl(value: string | null | undefined, fallback = "/"): string {
  const target = value?.trim();

  if (!target) {
    return fallback;
  }

  // `//evil.example` و `/\evil.example` به دامنهٔ بیرونی اشاره می‌کنند.
  if (target.startsWith("//") || target.startsWith("/\\")) {
    return fallback;
  }

  try {
    const url = new URL(target, RELATIVE_BASE);
    const path = `${url.pathname}${url.search}${url.hash}`;

    return path.startsWith("/") ? path : fallback;
  } catch {
    return fallback;
  }
}

/** رشتهٔ خالی، فاصله‌های اضافی و `null` را به `undefined` تبدیل می‌کند (برای فیلدهای اختیاری). */
export function optionalText(value: FormDataEntryValue | string | null | undefined): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : undefined;
}
