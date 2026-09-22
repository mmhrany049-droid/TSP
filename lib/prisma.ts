import { PrismaLibSQL } from "@prisma/adapter-libsql";
import { PrismaClient } from "@prisma/client";

import { resolveDatabaseUrl } from "./database-url";
import { logEnvDiagnostics } from "./env";

/**
 * نمونهٔ یگانهٔ PrismaClient.
 *
 * در حالت توسعه، Next.js ماژول‌ها را با هر تغییر دوباره بار می‌کند؛ اگر هر بار
 * اتصال تازه ساخته شود، تعداد اتصال‌ها به‌سرعت بالا می‌رود. پس نمونه را روی
 * `globalThis` نگه می‌داریم.
 *
 * کلاینت با «موتور بدون باینری بومی» (`engineType = "client"` در schema.prisma)
 * ساخته شده است؛ بنابراین آداپتور libSQL اجباری است و همان آداپتور، فایل SQLite
 * را می‌خواند و می‌نویسد.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrismaClient(): PrismaClient {
  // پیش از ساخت اتصال، تنظیمات محیطی خوانده و پیام‌های راهنما یک‌بار چاپ می‌شوند.
  logEnvDiagnostics();

  const adapter = new PrismaLibSQL({ url: resolveDatabaseUrl() });

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

export const prisma: PrismaClient = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;
