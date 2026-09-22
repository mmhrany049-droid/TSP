import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

import { authConfig } from "./auth.config";
import { verifyPassword } from "./password";
import { prisma } from "./prisma";
import { loginSchema } from "./validations";

/**
 * راه‌اندازی کامل NextAuth (Auth.js v5) با فراهم‌کنندهٔ «ایمیل و گذرواژه».
 *
 * جریان کار `authorize`:
 *   ۱. اعتبارسنجی ورودی با Zod (همان طرحی که در فرم هم استفاده می‌شود)
 *   ۲. یافتن کاربر با ایمیل
 *   ۳. مقایسهٔ گذرواژه با هش ذخیره‌شده (bcrypt)
 *
 * در هر شکستی `null` برگردانده می‌شود؛ NextAuth خودش خطای
 * «CredentialsSignin» می‌سازد و پیام عمومی «ایمیل یا گذرواژه نادرست است» را
 * به کاربر نشان می‌دهد. این کار جلوی افشای «کدام ایمیل ثبت شده است» را می‌گیرد.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      id: "credentials",
      name: "ایمیل و گذرواژه",
      credentials: {
        email: { label: "ایمیل", type: "email" },
        password: { label: "گذرواژه", type: "password" },
      },
      async authorize(rawCredentials) {
        const parsed = loginSchema.safeParse(rawCredentials);

        if (!parsed.success) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email },
          select: { id: true, email: true, name: true, passwordHash: true },
        });

        if (!user) {
          return null;
        }

        const isPasswordValid = await verifyPassword(parsed.data.password, user.passwordHash);

        if (!isPasswordValid) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name ?? user.email,
        };
      },
    }),
  ],
});
