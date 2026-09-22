import { NextResponse } from "next/server";

import { APP_VERSION } from "@/lib/constants";
import { getEnvStatus } from "@/lib/env";
import { prisma } from "@/lib/prisma";

/**
 * بررسی سلامت برنامه و اتصال پایگاه داده.
 *
 * GET /api/health
 */
export async function GET() {
  const envStatus = getEnvStatus();

  try {
    const [users, books, questions, attempts] = await Promise.all([
      prisma.user.count(),
      prisma.book.count(),
      prisma.question.count(),
      prisma.questionAttempt.count(),
    ]);

    return NextResponse.json({
      ok: true,
      data: {
        version: APP_VERSION,
        database: "connected",
        counts: { users, books, questions, attempts },
        env: {
          envFile: envStatus.envFileExists,
          authSecret: envStatus.hasAuthSecret ? "configured" : envStatus.authSecretIsFallback ? "development-fallback" : "missing",
        },
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "خطای نامشخص";
    const isMissingDatabase = /no such table|unable to open database file|does not exist|P1003|P2021/i.test(message);

    return NextResponse.json(
      {
        ok: false,
        error: isMissingDatabase
          ? "پایگاه داده آماده نیست. دستور `npm run db:setup` را اجرا کنید و دوباره تلاش کنید."
          : "اتصال به پایگاه داده برقرار نشد.",
        // جزئیات فنی برای عیب‌یابی، جدا از پیام کاربر.
        details: message,
      },
      { status: 500 },
    );
  }
}
