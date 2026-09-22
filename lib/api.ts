import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { BadRequestError, ConflictError, NotFoundError } from "@/lib/services/errors";
import { firstZodMessage, zodFieldErrors } from "@/lib/validations";
import type { ApiResult } from "@/types";
import { ZodError } from "zod";

/**
 * کمک‌کارهای مسیرهای API.
 *
 * هدف: هر مسیر API فقط «منطق خودش» را بنویسد؛ بررسی نشست، قالب پاسخ فارسی و
 * تبدیل خطاها همه اینجا متمرکز است تا رفتار همهٔ مسیرها یکسان بماند.
 *
 * قالب پاسخ‌ها همان `ApiResult` مشترک برنامه است:
 *   - موفق: `{ ok: true, data: … }`
 *   - ناموفق: `{ ok: false, error: "پیام فارسی", fieldErrors?: { فیلد: پیام } }`
 */

/** کاربر واردشده، همان‌قدر که سرویس‌ها لازم دارند. */
export interface ApiUser {
  id: string;
  email: string;
  name: string | null;
}

/** پاسخ موفق. */
export function apiOk<T>(data: T, status = 200): NextResponse<ApiResult<T>> {
  return NextResponse.json({ ok: true, data }, { status });
}

/** پاسخ ناموفق با پیام فارسی. */
export function apiError(
  message: string,
  status = 400,
  fieldErrors?: Record<string, string>,
): NextResponse<ApiResult<never>> {
  return NextResponse.json({ ok: false, error: message, ...(fieldErrors ? { fieldErrors } : {}) }, { status });
}

/**
 * بررسی نشست کاربر.
 *
 * اگر کاربر وارد نشده باشد، پاسخ ۴۰۱ با پیام فارسی برگردانده می‌شود تا سمت مرورگر
 * بتواند کاربر را به صفحهٔ ورود بفرستد.
 */
export async function requireApiUser(): Promise<
  { user: ApiUser; response?: undefined } | { user?: undefined; response: NextResponse<ApiResult<never>> }
> {
  const session = await auth();

  if (!session?.user?.id) {
    return { response: apiError("برای این کار باید وارد حساب خود شوید.", 401) };
  }

  return {
    user: {
      id: session.user.id,
      email: session.user.email ?? "",
      name: session.user.name ?? null,
    },
  };
}

/**
 * تبدیل خطاهای شناخته‌شده به پاسخ فارسی.
 *
 * - `ZodError` → کد ۴۰۰ همراه خطای زیر هر فیلد
 * - `NotFoundError` → کد ۴۰۴ («پیدا نشد» یا «دسترسی ندارید»)
 * - `BadRequestError` → کد ۴۰۰
 * - `ConflictError` → کد ۴۰۹
 * - بقیه → کد ۵۰۰ با پیام عمومی (جزئیات فقط در کنسول سرور)
 */
export function handleApiError(error: unknown): NextResponse<ApiResult<never>> {
  if (error instanceof ZodError) {
    return apiError(firstZodMessage(error), 400, zodFieldErrors(error));
  }

  if (error instanceof NotFoundError) {
    return apiError(error.message, 404);
  }

  if (error instanceof BadRequestError) {
    return apiError(error.message, 400);
  }

  if (error instanceof ConflictError) {
    return apiError(error.message, 409);
  }

  console.error("[API] خطای غیرمنتظره:", error);

  const message = error instanceof Error ? error.message : String(error);
  const isDatabaseProblem = /prisma|database|sqlite|no such table|P1003|P2021|SQLITE_/i.test(message);

  return apiError(
    isDatabaseProblem
      ? "پایگاه داده آماده نیست. دستور `npm run db:setup` را اجرا کنید."
      : "انجام درخواست ممکن نشد؛ لطفاً دوباره تلاش کنید.",
    isDatabaseProblem ? 503 : 500,
  );
}

/** خواندن بدنهٔ JSON با پیام فارسی در صورت خرابی. */
export async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new BadRequestError("بدنهٔ درخواست باید JSON معتبر باشد.");
  }
}
