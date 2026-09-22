import { z } from "zod";

/**
 * طرح‌های اعتبارسنجی ورودی‌های کاربر (Zod).
 *
 * همهٔ پیام‌های خطا فارسی‌اند تا مستقیم در فرم‌ها نمایش داده شوند. همین طرح‌ها هم
 * در فرم‌های سمت مرورگر و هم در API و در `authorize` استفاده می‌شوند؛ پس قاعدهٔ
 * اعتبارسنجی فقط یک‌جا نوشته شده است.
 */

/** فیلد ایمیل مشترک ورود و ثبت‌نام. */
const emailField = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "ایمیل را وارد کنید.")
  .email("ایمیل معتبر نیست.");

/** گذرواژهٔ ورود: فقط باید خالی نباشد (طول در ثبت‌نام بررسی می‌شود). */
const passwordField = z
  .string()
  .min(1, "گذرواژه را وارد کنید.")
  .max(72, "گذرواژه نمی‌تواند بیشتر از ۷۲ نویسه باشد.");

/** طرح ورود (Credentials). */
export const loginSchema = z.object({
  email: emailField,
  password: passwordField,
});

/** طرح ثبت‌نام. */
export const registerSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "نام باید حداقل ۲ نویسه باشد.")
      .max(60, "نام نمی‌تواند بیشتر از ۶۰ نویسه باشد."),
    email: emailField,
    password: z
      .string()
      .min(8, "گذرواژه باید حداقل ۸ نویسه باشد.")
      .max(72, "گذرواژه نمی‌تواند بیشتر از ۷۲ نویسه باشد."),
    confirmPassword: z.string().min(1, "تکرار گذرواژه را وارد کنید."),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "تکرار گذرواژه با گذرواژه یکسان نیست.",
    path: ["confirmPassword"],
  });

/** ورودی معتبرشدهٔ ورود. */
export type LoginInput = z.infer<typeof loginSchema>;

/** ورودی معتبرشدهٔ ثبت‌نام. */
export type RegisterInput = z.infer<typeof registerSchema>;

/** آنچه برای ساخت کاربر لازم است (بدون فیلد تکرار گذرواژه). */
export type NewUserInput = Omit<RegisterInput, "confirmPassword">;

/**
 * تبدیل خطاهای Zod به نگاشت «نام فیلد → نخستین پیام خطا».
 *
 * فرم‌ها با این نگاشت، خطا را زیر همان فیلد نشان می‌دهند.
 */
export function zodFieldErrors(error: z.ZodError): Record<string, string> {
  const fieldErrors: Record<string, string> = {};

  for (const issue of error.issues) {
    const field = issue.path.length > 0 ? String(issue.path[0]) : "form";
    fieldErrors[field] ??= issue.message;
  }

  return fieldErrors;
}

/** نخستین پیام خطا؛ برای نمایش در نوار خطای بالای فرم. */
export function firstZodMessage(error: z.ZodError): string {
  return error.issues[0]?.message ?? "اطلاعات واردشده معتبر نیست.";
}
