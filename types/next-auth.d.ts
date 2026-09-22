import type { DefaultSession } from "@auth/core/types";

/**
 * توسعهٔ تایپ‌های NextAuth.
 *
 * به‌طور پیش‌فرض `session.user` شناسه ندارد؛ در حالی که همهٔ ماژول‌های TSP داده‌ها
 * را با شناسهٔ کاربر فیلتر می‌کنند. با این «ادغام ماژول» تایپ، `session.user.id` در
 * تمام برنامه یک `string` شناخته می‌شود و نیازی به تبدیل نوع (cast) نیست.
 */
declare module "@auth/core/types" {
  interface Session {
    user: {
      id: string;
    } & DefaultSession["user"];
  }
}
