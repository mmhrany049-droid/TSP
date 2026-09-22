import type { NextAuthConfig } from "next-auth";
import { NextResponse } from "next/server";

/**
 * تنظیمات پایهٔ احراز هویت (بدون وابستگی به پایگاه داده).
 *
 * این فایل عمداً از Prisma و bcrypt فاصله دارد، چون `middleware.ts` در محیط
 * «Edge» اجرا می‌شود و در آنجا نه فایل SQLite در دسترس است و نه ماژول‌های بومی.
 * در نتیجه میدل‌ور فقط توکن رمزگشایی‌شدهٔ نشست را می‌خواند و بررسی می‌کند.
 *
 * فایل `lib/auth.ts` همین تنظیمات را با «فراهم‌کنندهٔ ایمیل و گذرواژه» کامل می‌کند.
 */

/** مسیرهای مخصوص مهمان‌ها؛ کاربر واردشده نباید این‌ها را ببیند. */
export const AUTH_ROUTES = ["/login", "/register"] as const;

/** مقصد پیش‌فرض پس از ورود موفق. */
export const DEFAULT_LOGIN_REDIRECT = "/";

/** مسیر صفحهٔ ورود (هم برای میدل‌ور و هم برای فرم‌ها). */
export const LOGIN_PATH = "/login";

/** عمر نشست: ۳۰ روز؛ برای یک اپلیکیشن مطالعهٔ روزانه کافی است. */
export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

export const authConfig: NextAuthConfig = {
  // پشت پروکسی (پیش‌نمایش، میزبان ابری) هم کار کند.
  trustHost: true,
  pages: {
    signIn: LOGIN_PATH,
    error: LOGIN_PATH,
  },
  session: {
    // فراهم‌کنندهٔ Credentials فقط با نشست JWT کار می‌کند.
    strategy: "jwt",
    maxAge: SESSION_MAX_AGE_SECONDS,
  },
  // فراهم‌کننده‌ها در `lib/auth.ts` افزوده می‌شوند تا این فایل سبک بماند.
  providers: [],
  callbacks: {
    /**
     * تصمیم میدل‌ور: چه کسی اجازهٔ دیدن چه مسیری را دارد.
     * بازگشت `false` یعنی «به صفحهٔ ورود منتقل شود».
     */
    authorized({ request, auth }) {
      const { nextUrl } = request;
      const isLoggedIn = Boolean(auth?.user);
      const isAuthRoute = AUTH_ROUTES.some((route) => nextUrl.pathname === route);

      if (isAuthRoute) {
        // کاربر واردشده در صفحهٔ ورود/ثبت‌نام کاری ندارد.
        return isLoggedIn ? NextResponse.redirect(new URL(DEFAULT_LOGIN_REDIRECT, nextUrl)) : true;
      }

      return isLoggedIn;
    },

    /** افزودن شناسهٔ کاربر به توکن، تا در همهٔ درخواست‌ها در دسترس باشد. */
    jwt({ token, user }) {
      if (user?.id) {
        token.id = user.id;
      }

      return token;
    },

    /** انتقال شناسه از توکن به نشست، برای `session.user.id` در سرور. */
    session({ session, token }) {
      const userId = typeof token.id === "string" ? token.id : token.sub;

      if (userId) {
        session.user.id = userId;
      }

      return session;
    },
  },
};
