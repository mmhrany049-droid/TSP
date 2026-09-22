import { NextResponse } from "next/server";

import { APP_VERSION } from "@/lib/constants";
import { prisma } from "@/lib/prisma";

/**
 * بررسی سلامت برنامه و اتصال پایگاه داده.
 *
 * GET /api/health
 */
export async function GET() {
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
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "خطای نامشخص";

    return NextResponse.json(
      { ok: false, error: `اتصال به پایگاه داده برقرار نشد: ${message}` },
      { status: 500 },
    );
  }
}
