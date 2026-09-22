import type { ApiResult } from "@/types";

/**
 * فراخوانی APIهای برنامه از سمت مرورگر.
 *
 * چرا یک تابع مشترک؟ چون همهٔ مسیرها قالب `ApiResult` را برمی‌گردانند و اینجا
 * یک‌بار برای همیشه مدیریت می‌شود: پارس JSON، پیام خطای فارسی و خطای شبکه.
 */
export async function apiRequest<T>(
  url: string,
  init: { method?: string; body?: unknown } = {},
): Promise<ApiResult<T>> {
  try {
    const response = await fetch(url, {
      method: init.method ?? "GET",
      headers: init.body === undefined ? undefined : { "Content-Type": "application/json" },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });

    // پاسخ‌های بدون بدنه (نادر، ولی ممکن) هم نباید کرش کنند.
    const payload = (await response.json().catch(() => null)) as ApiResult<T> | null;

    if (payload && typeof payload === "object" && "ok" in payload) {
      return payload;
    }

    return { ok: false, error: "پاسخ سرور قابل خواندن نبود؛ لطفاً دوباره تلاش کنید." };
  } catch {
    return { ok: false, error: "ارتباط با سرور برقرار نشد؛ اتصال خود را بررسی کنید." };
  }
}

/** پیام خطای قابل نمایش از نتیجهٔ API. */
export function messageOf<T>(result: ApiResult<T>, fallback = "انجام عملیات ممکن نشد."): string {
  return result.ok ? fallback : result.error;
}
