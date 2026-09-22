import type { NextAuthConfig } from "next-auth";
import { NextResponse } from "next/server";

import {
  resolveAuthSecret,
  resolveAuthSecretState,
  warnAboutAuthSecretOnce,
} from "./auth-secret";

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

/*
 * هشدار یک‌باره دربارهٔ کلید نشست.
 * این فایل هم در میدل‌ور (Edge) و هم در سرور (Node) بار می‌شود، پس هشدار در هر دو
 * محیط دیده می‌شود. تابع هیچ وابستگی‌ای به سیستم فایل ندارد و در Edge هم بی‌خطر است.
 */
warnAboutAuthSecretOnce();

export const authConfig: NextAuthConfig = {
  // پشت پروکسی (پیش‌نمایش، میزبان ابری) هم کار کند.
  trustHost: true,
  /*
   * کلید امضای نشست.
   *
   *   • اگر AUTH_SECRET تنظیم شده باشد → همان.
   *   • در حالت توسعه و بدون AUTH_SECRET → کلید موقت ثابت، تا برنامه بالا بیاید و
   *     کوکی نوشته‌شده در Node برای میدل‌ور (Edge) هم معتبر باشد (جلوگیری از حلقهٔ
   *     ریدایرکت).
   *   • در حالت تولید و بدون AUTH_SECRET → undefined؛ NextAuth خطای رسمی می‌دهد و
   *     `app/error.tsx` آن را به پیام فارسی «کلید تنظیم نشده» تبدیل می‌کند.
   */
  secret: resolveAuthSecret(),
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
     *
     * خروجی‌ها:
     *   • `true`  → عبور بده.
     *   • `NextResponse` → همین پاسخ برگردانده شود (ریدایرکت صریح).
     *
     * چرا به‌جای `false` ریدایرکت صریح برمی‌گردانیم؟ چون NextAuth در حالت «عبور
     * دادن» بهتر می‌تواند با پاسخ‌های سفارشی کار کند و مقصد بازگشت (`callbackUrl`)
     * را هم خودمان می‌سازیم تا مسیر درخواستی کاربر حفظ شود.
     */
    authorized({ request, auth }) {
      const { nextUrl } = request;

      /*
       * در حالت تولید، اگر کلید نشست تنظیم نشده باشد میدل‌ور تصمیم نمی‌گیرد و
       * درخواست را رد می‌کند تا صفحه‌ها پیام فارسی راهنما را نشان دهند؛ چون در این
       * وضعیت هیچ نشستی قابل اعتبارسنجی نیست و ریدایرکت‌کردن کاربر فقط او را در
       * حلقه می‌اندازد.
       */
      if (resolveAuthSecretState().isMissingInProduction) {
        return NextResponse.next();
      }

      const isLoggedIn = Boolean(auth?.user);
      const isAuthRoute = AUTH_ROUTES.some((route) => nextUrl.pathname === route);

      if (isAuthRoute) {
        // کاربر واردشده در صفحهٔ ورود/ثبت‌نام کاری ندارد.
        return isLoggedIn ? NextResponse.redirect(new URL(DEFAULT_LOGIN_REDIRECT, nextUrl)) : true;
      }

      if (isLoggedIn) {
        return true;
      }

      // بازگشت به صفحهٔ ورود، همراه با مقصد درخواستی کاربر.
      const loginUrl = new URL(LOGIN_PATH, nextUrl);
      const requestedPath = `${nextUrl.pathname}${nextUrl.search}`;

      if (requestedPath !== LOGIN_PATH) {
        loginUrl.searchParams.set("callbackUrl", requestedPath);
      }

      return NextResponse.redirect(loginUrl);
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
