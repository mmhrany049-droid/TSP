#!/usr/bin/env node
/**
 * کارهای پس از نصب بسته‌ها (`npm install`).
 *
 * دو کار مهم انجام می‌دهد و **هرگز نباید نصب را شکست بدهد**:
 *   ۱. اگر فایل `.env` نباشد، آن را با `AUTH_SECRET` تصادفی می‌سازد؛ بنابراین کاربر
 *      حتی اگر یادش برود، با نخستین اجرا خطای «کلید امنیتی تنظیم نشده» نمی‌گیرد.
 *   ۲. کلاینت Prisma را می‌سازد. اگر این کار با خطا روبه‌رو شود (مثلاً نبود اینترنت
 *      برای فایل‌های کمکی)، به‌جای شکست‌دادن نصب، پیام فارسی چاپ می‌کند؛ چون خودِ
 *      اسکریپت راه‌اندازی (`npm run dev:open`) دوباره تلاش می‌کند.
 *
 * چرا مهم است؟ روی ویندوز، خطای نصب باعث می‌شود کاربر هیچ دستوری را نتواند اجرا کند
 * و پیام خطای خام Prisma برای کاربر مبتدی گیج‌کننده است.
 */
import fs from "node:fs";
import path from "node:path";

import { runPrisma } from "./lib/db-status.mjs";
import { ensureAuthSecretInEnvFile, ensureEnvFile, readEnvFile } from "./lib/env-file.mjs";

const PROJECT_ROOT = process.cwd();

function main() {
  console.log("\n▸ آماده‌سازی TSP پس از نصب…");

  // ── ۱) فایل .env ─────────────────────────────────────────────────────────
  const env = ensureEnvFile({ projectRoot: PROJECT_ROOT, create: true });

  if (env.created) {
    console.log("  ✔ فایل .env ساخته شد (DATABASE_URL و AUTH_SECRET تصادفی).");
  } else if (env.missingAuthSecret) {
    ensureAuthSecretInEnvFile(PROJECT_ROOT);
    console.log("  ✔ کلید AUTH_SECRET به فایل .env اضافه شد.");
  } else {
    console.log("  • فایل .env آماده است.");
  }

  // ── ۲) کلاینت Prisma ─────────────────────────────────────────────────────
  if (!fs.existsSync(path.join(PROJECT_ROOT, "node_modules", "prisma"))) {
    console.warn("  ⚠ بستهٔ Prisma نصب نشده است؛ ساخت کلاینت رد شد.");
    return;
  }

  const result = runPrisma(["generate", "--schema", "prisma/schema.prisma"], {
    projectRoot: PROJECT_ROOT,
    quiet: true,
  });

  if (result.ok) {
    console.log("  ✔ کلاینت Prisma ساخته شد.");
  } else {
    console.warn(
      [
        "  ⚠ ساخت کلاینت Prisma انجام نشد (نصب ادامه می‌یابد).",
        "    راه‌حل: `npm run db:setup` را اجرا کنید. اگر خطا ادامه داشت `npm run doctor`.",
        result.hint
          ? result.hint
              .split("\n")
              .map((line) => `    ${line}`)
              .join("\n")
          : "",
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }

  // ── ۳) راهنمای گام بعد ───────────────────────────────────────────────────
  const databaseReady = fs.existsSync(path.join(PROJECT_ROOT, "prisma", "dev.db"));

  console.log(
    databaseReady
      ? "\n✔ نصب کامل شد. برای اجرا:  npm run dev:open\n"
      : "\n✔ نصب کامل شد. گام بعد:\n    npm run db:setup\n    npm run dev:open\n",
  );

  // بررسی نهایی اینکه کلید واقعاً نوشته شده باشد (تا کاربر بی‌دلیل خطای احراز هویت نگیرد).
  const values = readEnvFile(path.join(PROJECT_ROOT, ".env"));

  if (!values.AUTH_SECRET) {
    console.warn(
      "⚠ AUTH_SECRET در فایل .env نوشته نشد. دستی بررسی کنید یا `npm run init:env -- --force` را اجرا کنید.",
    );
  }
}

try {
  main();
} catch (error) {
  // شکست این اسکریپت هرگز نباید `npm install` را متوقف کند.
  console.warn(
    [
      "",
      "⚠ آماده‌سازی پس از نصب کامل نشد (نصب بسته‌ها سالم است):",
      `  ${error instanceof Error ? error.message : error}`,
      "  • برای اجرای پروژه: npm run db:setup و بعد npm run dev:open",
      "  • برای عیب‌یابی: npm run doctor",
      "",
    ].join("\n"),
  );
}
