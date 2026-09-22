import { NextResponse } from "next/server";

import {
  EMAIL_TAKEN_MESSAGE,
  EmailAlreadyRegisteredError,
  registerUser,
  type AuthUser,
} from "@/lib/services/user";
import { firstZodMessage, registerSchema, zodFieldErrors } from "@/lib/validations";
import type { ApiResult } from "@/types";

/**
 * ثبت‌نام کاربر تازه: `POST /api/auth/register`
 *
 * ورودی و خروجی هر دو JSON هستند و قالب پاسخ همان `ApiResult` مشترک برنامه است:
 *   - موفق: `{ ok: true, data: { user } }` با کد ۲۰۱
 *   - خطای اعتبارسنجی: کد ۴۰۰ همراه `fieldErrors` برای نمایش زیر هر فیلد
 *   - ایمیل تکراری: کد ۴۰۹
 *
 * نکتهٔ امنیتی: گذرواژه فقط به‌صورت هش‌شده (bcrypt) ذخیره می‌شود و در پاسخ
 * هیچ‌گاه (حتی هش آن) برگردانده نمی‌شود.
 */
export const runtime = "nodejs";

export async function POST(
  request: Request,
): Promise<NextResponse<ApiResult<{ user: AuthUser }>>> {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "بدنهٔ درخواست باید JSON معتبر باشد." },
      { status: 400 },
    );
  }

  const parsed = registerSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: firstZodMessage(parsed.error),
        fieldErrors: zodFieldErrors(parsed.error),
      },
      { status: 400 },
    );
  }

  try {
    const user = await registerUser(parsed.data);

    return NextResponse.json({ ok: true, data: { user } }, { status: 201 });
  } catch (error) {
    if (error instanceof EmailAlreadyRegisteredError) {
      return NextResponse.json(
        { ok: false, error: EMAIL_TAKEN_MESSAGE, fieldErrors: { email: EMAIL_TAKEN_MESSAGE } },
        { status: 409 },
      );
    }

    console.error("[ثبت‌نام] خطای غیرمنتظره:", error);

    const message = error instanceof Error ? error.message : String(error);
    const isDatabaseProblem = /prisma|database|sqlite|no such table|P1003|P2021|SQLITE_/i.test(message);

    return NextResponse.json(
      {
        ok: false,
        error: isDatabaseProblem
          ? "پایگاه داده آماده نیست. دستور `npm run db:setup` را اجرا کنید و دوباره تلاش کنید."
          : "ثبت‌نام انجام نشد؛ لطفاً دوباره تلاش کنید.",
        ...(isDatabaseProblem ? { fieldErrors: {} } : {}),
      },
      { status: 500 },
    );
  }
}
