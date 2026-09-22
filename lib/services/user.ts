import { hashPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import type { NewUserInput } from "@/lib/validations";

/**
 * کارهای مربوط به کاربر (ثبت‌نام و خواندن).
 *
 * منطق دامنه اینجا می‌نشیند تا هم API و هم فرم‌ها از یک مسیر استفاده کنند و
 * قواعد (یکتایی ایمیل، هش گذرواژه) فقط یک‌بار نوشته شود.
 */

/** اطلاعات امن کاربر؛ هرگز `passwordHash` را برنمی‌گردانیم. */
export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
}

/** ایمیل تکراری؛ در API به کد ۴۰۹ و در فرم به خطای زیر فیلد ایمیل تبدیل می‌شود. */
export class EmailAlreadyRegisteredError extends Error {
  constructor(email: string) {
    super(`این ایمیل قبلاً ثبت شده است: ${email}`);
    this.name = "EmailAlreadyRegisteredError";
  }
}

/** پیام فارسی خطای ایمیل تکراری، برای نمایش در فرم. */
export const EMAIL_TAKEN_MESSAGE = "این ایمیل قبلاً ثبت شده است؛ می‌توانید وارد شوید.";

/** تشخیص خطای «نقض یکتایی» در Prisma بدون وابستگی به تایپ‌های داخلی آن. */
function isUniqueConstraintViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}

/** نرمال‌سازی ایمیل: بدون فاصلهٔ اضافه و با حروف کوچک. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** ساخت حساب کاربری تازه؛ اگر ایمیل تکراری باشد خطای دامنه پرتاب می‌شود. */
export async function registerUser(input: NewUserInput): Promise<AuthUser> {
  const email = normalizeEmail(input.email);

  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (existingUser) {
    throw new EmailAlreadyRegisteredError(email);
  }

  const passwordHash = await hashPassword(input.password);

  try {
    return await prisma.user.create({
      data: {
        email,
        name: input.name.trim(),
        passwordHash,
      },
      select: { id: true, email: true, name: true },
    });
  } catch (error) {
    // دو درخواست هم‌زمان می‌توانند از بررسی بالا رد شوند؛ محدودیت یکتایی
    // پایگاه داده آخرین خط دفاعی است و به همان خطای دامنه تبدیل می‌شود.
    if (isUniqueConstraintViolation(error)) {
      throw new EmailAlreadyRegisteredError(email);
    }

    throw error;
  }
}

/** یافتن کاربر با ایمیل (برای استفاده‌های آیندهٔ ماژول‌های دیگر). */
export function findUserByEmail(email: string): Promise<AuthUser | null> {
  return prisma.user.findUnique({
    where: { email: normalizeEmail(email) },
    select: { id: true, email: true, name: true },
  });
}
