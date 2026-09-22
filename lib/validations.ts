import { z } from "zod";

// نکته: پسوند `.ts` عمدی است. آزمون‌های واحد با `node --experimental-strip-types`
// اجرا می‌شوند و آن اجراکننده برای واردکردن فایل‌های محلی به پسوند صریح نیاز دارد.
import { ANSWER_CHOICES, BOOK_NODE_TYPES, PUBLISHER_DIFFICULTIES } from "./constants.ts";

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

// ---------------------------------------------------------------------------
// کتاب و ساختار کتاب (پرامپت ۳ — LibraryManager)
// ---------------------------------------------------------------------------

/**
 * تعریف یک رشتهٔ اختیاری: فاصله‌ها گرفته می‌شود، طول بررسی می‌شود و رشتهٔ خالی به
 * `undefined` تبدیل می‌شود تا در پایگاه داده «خالی» و «تنظیم‌نشده» یکی شوند.
 */
function optionalString(max: number, label: string) {
  return z
    .string()
    .trim()
    .max(max, `${label} نمی‌تواند بیشتر از ${max} نویسه باشد.`)
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined));
}

/** طرح ایجاد/ویرایش کتاب. */
export const bookSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "عنوان کتاب را وارد کنید.")
    .max(120, "عنوان کتاب نمی‌تواند بیشتر از ۱۲۰ نویسه باشد."),
  subject: z
    .string()
    .trim()
    .min(1, "درس کتاب را وارد کنید (مثلاً فیزیک).")
    .max(60, "نام درس نمی‌تواند بیشتر از ۶۰ نویسه باشد."),
  publisher: optionalString(80, "نام ناشر"),
  grade: optionalString(30, "پایه"),
  field: optionalString(40, "رشته"),
  notes: optionalString(500, "یادداشت"),
});

/** طرح ایجاد/ویرایش گرهٔ ساختار کتاب (فصل، بخش، …). */
export const bookNodeSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "عنوان فصل یا بخش را وارد کنید.")
    .max(120, "عنوان نمی‌تواند بیشتر از ۱۲۰ نویسه باشد."),
  nodeType: z.enum(BOOK_NODE_TYPES.values, { message: "نوع گره معتبر نیست." }),
  parentId: optionalString(40, "شناسهٔ والد"),
  orderIndex: z.coerce
    .number()
    .int("ترتیب باید عدد صحیح باشد.")
    .min(0, "ترتیب نمی‌تواند منفی باشد.")
    .max(9999, "ترتیب بیش از حد بزرگ است.")
    .default(0),
});

/** فیلد بولین که هم از JSON و هم از فرم (checkbox) درست خوانده می‌شود. */
const booleanFlag = z.preprocess(
  (value) => value === true || value === "true" || value === "on" || value === 1 || value === "1",
  z.boolean(),
);

/** طرح ایجاد/ویرایش تست. */
export const questionSchema = z.object({
  bookId: z.string().trim().min(1, "کتاب تست را انتخاب کنید."),
  bookNodeId: z.string().trim().min(1, "محل تست در ساختار کتاب را انتخاب کنید."),
  displayNumber: z
    .string()
    .trim()
    .min(1, "شمارهٔ نمایشی تست را وارد کنید.")
    .max(30, "شمارهٔ نمایشی نمی‌تواند بیشتر از ۳۰ نویسه باشد."),
  correctAnswer: z.enum(ANSWER_CHOICES, { message: "پاسخ صحیح باید یکی از گزینه‌های ۱ تا ۴ باشد." }),
  publisherDifficulty: z
    .union([z.enum(PUBLISHER_DIFFICULTIES.values, { message: "سختی ناشر معتبر نیست." }), z.literal("")])
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined)),
  isImportant: booleanFlag.optional().default(false),
  isHard: booleanFlag.optional().default(false),
});

/** کارهایی که روی یک تست می‌توان انجام داد (بدون تغییر کتاب و محل آن). */
export const questionPatchSchema = z.object({
  displayNumber: z
    .string()
    .trim()
    .min(1, "شمارهٔ نمایشی تست را وارد کنید.")
    .max(30, "شمارهٔ نمایشی نمی‌تواند بیشتر از ۳۰ نویسه باشد.")
    .optional(),
  correctAnswer: z
    .enum(ANSWER_CHOICES, { message: "پاسخ صحیح باید یکی از گزینه‌های ۱ تا ۴ باشد." })
    .optional(),
  publisherDifficulty: z
    .union([z.enum(PUBLISHER_DIFFICULTIES.values, { message: "سختی ناشر معتبر نیست." }), z.literal("")])
    .optional()
    .transform((value) => (value === undefined ? undefined : value.length > 0 ? value : null)),
  isImportant: booleanFlag.optional(),
  isHard: booleanFlag.optional(),
  isActive: booleanFlag.optional(),
  bookNodeId: z.string().trim().min(1, "محل تست را انتخاب کنید.").optional(),
});

export type BookInput = z.infer<typeof bookSchema>;
export type BookNodeInput = z.infer<typeof bookNodeSchema>;
export type QuestionInput = z.infer<typeof questionSchema>;
export type QuestionPatchInput = z.infer<typeof questionPatchSchema>;

/** فیلترهای فهرست بانک تست که از رشتهٔ پرس‌وجو (`?bookId=…&page=2`) خوانده می‌شوند. */
export const questionQuerySchema = z.object({
  bookId: z.string().trim().min(1).optional(),
  bookNodeId: z.string().trim().min(1).optional(),
  important: z.enum(["true", "false"]).optional(),
  hard: z.enum(["true", "false"]).optional(),
  inactive: z.enum(["true", "false"]).optional(),
  publisherDifficulty: z.enum(PUBLISHER_DIFFICULTIES.values).optional(),
  search: z.string().trim().max(60).optional(),
  page: z.coerce.number().int().min(1).max(100_000).optional(),
  perPage: z.coerce.number().int().min(1).max(100).optional(),
});

export type QuestionQuery = z.infer<typeof questionQuerySchema>;
