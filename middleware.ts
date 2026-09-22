import NextAuth from "next-auth";

import { authConfig } from "@/lib/auth.config";

/**
 * میدل‌ور محافظت از مسیرهای خصوصی.
 *
 * میدل‌ور در محیط «Edge» اجرا می‌شود، پس فقط `auth.config.ts` سبک را می‌خواند
 * (بدون Prisma و bcrypt). تصمیم‌گیری در `callbacks.authorized` انجام می‌شود:
 * کاربر واردنشده به «/login?callbackUrl=...» هدایت می‌شود و کاربر واردشده از
 * صفحه‌های ورود/ثبت‌نام به داشبورد برمی‌گردد.
 */
export default NextAuth(authConfig).auth;

export const config = {
  /*
   * همهٔ مسیرها محافظت می‌شوند، به‌جز:
   *  - `api`  → مسیرهای API (از جمله `/api/auth/*` و `/api/health`) خودشان بررسی می‌کنند
   *  - `_next` → فایل‌های ساخته‌شدهٔ Next.js
   *  - فایل‌های ایستا (نشان، تصویر، قلم) که باید در صفحهٔ ورود هم بارگذاری شوند
   */
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|woff|woff2|txt|xml)$).*)",
  ],
};
