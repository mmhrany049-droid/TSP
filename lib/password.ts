import { compare, hash } from "bcryptjs";

/**
 * کار با گذرواژه‌ها.
 *
 * قاعدهٔ امنیتی: گذرواژه هرگز به‌صورت متن خام ذخیره نمی‌شود؛ فقط هش bcrypt آن در
 * `User.passwordHash` می‌نشیند. bcryptjs یک پیاده‌سازی خالص جاوااسکریپت است، پس
 * برای اجرا به هیچ ابزار ساخت بومی (C/C++) نیاز ندارد و روی هر سیستم‌عاملی کار می‌کند.
 */

/**
 * هزینهٔ رمزنگاری bcrypt.
 *
 * 「هزینه」 یعنی تعداد دورهای محاسبه؛ هر چه بیشتر باشد، حدس‌زدن گذرواژه سخت‌تر و
 * ورود کمی کندتر می‌شود. مقدار ۱۰ روی ماشین‌های معمولی حدود ۵۰ میلی‌ثانیه طول
 * می‌کشد که تعادل معقولی میان امنیت و سرعت است.
 */
export const BCRYPT_ROUNDS = 10;

/** ساخت هش گذرواژه برای ذخیره در پایگاه داده. */
export function hashPassword(plainPassword: string): Promise<string> {
  return hash(plainPassword, BCRYPT_ROUNDS);
}

/**
 * بررسی مطابقت گذرواژهٔ ورودی با هش ذخیره‌شده.
 *
 * اگر هش خراب یا خالی باشد، به‌جای بالا آمدن خطا مقدار `false` برگردانده می‌شود تا
 * ورود فقط «ناموفق» شود و پیام فنی به کاربر نرسد.
 */
export async function verifyPassword(plainPassword: string, passwordHash: string): Promise<boolean> {
  if (!passwordHash) {
    return false;
  }

  try {
    return await compare(plainPassword, passwordHash);
  } catch {
    return false;
  }
}
