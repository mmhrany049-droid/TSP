import path from "node:path";

import { PrismaLibSQL } from "@prisma/adapter-libsql";
import { defineConfig } from "prisma/config";

import "dotenv/config";

/*
 * چرا این خط لازم است؟
 * اگر پروژه تازه کلون شده باشد و هنوز فایل `.env` ساخته نشده باشد، متغیر
 * `DATABASE_URL` تعریف نشده است؛ در آن حالت ابزار Prisma نمی‌تواند مقدار
 * `env("DATABASE_URL")` را در schema.prisma حل کند و بی‌سروصدا سراغ موتور باینری
 * می‌رود (که دانلودش هم در برخی شبکه‌ها مسدود است و پیام خطای گیج‌کننده می‌دهد).
 * با گذاشتن مقدار پیش‌فرض، ساخت کلاینت و پایگاه داده حتی بدون `.env` هم کار می‌کند.
 */
process.env.DATABASE_URL ||= "file:./prisma/dev.db";

/**
 * پیکربندی Prisma برای TSP.
 *
 * چند نکته مهم:
 *   • چون فایل پیکربندی وجود دارد، Prisma خودش `.env` را نمی‌خواند؛ پس در همان
 *     ابتدا با `dotenv/config` بارگذاری می‌شود.
 *   • از «موتور طرح‌وارهٔ جاوااسکریپتی» (`engine: "js"`) همراه آداپتور libSQL
 *     استفاده می‌کنیم؛ بنابراین نه برای ساخت/مهاجرت پایگاه داده و نه در زمان اجرا
 *     به دانلود باینری بومی نیازی نیست و پروژه روی هر سیستم‌عاملی (از جمله ویندوز)
 *     یکسان اجرا می‌شود.
 *   • گره `experimental.adapter` باید روشن باشد تا آداپتور راننده فعال شود.
 */

/** آدرس پایگاه داده را به مسیر مطلق تبدیل می‌کند تا محل فایل مبهم نباشد. */
function resolveDatabaseUrl(): string {
  const raw = process.env.DATABASE_URL ?? "file:./prisma/dev.db";

  if (!raw.startsWith("file:")) {
    return raw;
  }

  const filePath = raw.slice("file:".length);

  return path.isAbsolute(filePath) ? raw : `file:${path.resolve(process.cwd(), filePath)}`;
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  experimental: { adapter: true },
  engine: "js",
  adapter: async () => new PrismaLibSQL({ url: resolveDatabaseUrl() }),
});
