import { handlers } from "@/lib/auth";

/**
 * مسیرهای خودِ NextAuth: ورود، خروج، نشست و توکن CSRF.
 *
 * همهٔ این‌ها زیر `/api/auth/*` هستند و باید در محیط Node.js اجرا شوند، چون
 * بررسی گذرواژه و اتصال پایگاه داده (SQLite با آداپتور libSQL) در Edge ممکن نیست.
 */
export const runtime = "nodejs";

export const { GET, POST } = handlers;
