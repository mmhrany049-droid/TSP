#!/usr/bin/env node
/**
 * ابزار پایگاه دادهٔ TSP.
 *
 *   npm run db:setup    → ساخت/هم‌گام‌سازی پایگاه دادهٔ محلی + تولید کلاینت Prisma
 *   npm run db:check    → فقط بررسی وضعیت (بدون تغییر چیزی)
 *   npm run db:deploy   → اعمال مهاجرت‌های موجود در prisma/migrations
 *   npm run db:reset    → پاک‌کردن پایگاه دادهٔ محلی و ساخت دوبارهٔ آن (بی‌بازگشت)
 *
 * چرا این ابزار لازم است؟
 *   پروژه از «موتور طرح‌وارهٔ جاوااسکریپتی» Prisma استفاده می‌کند تا به باینری بومی
 *   نیازی نباشد و روی هر سیستم‌عاملی یکسان اجرا شود. این موتور هنوز آزمایشی است و:
 *     ۱) پیش از مهاجرت، جدول داخلی `_prisma_migrations` را نمی‌سازد؛
 *     ۲) برای `migrate dev` نمی‌تواند پایگاه دادهٔ سایه (shadow) را آماده کند.
 *   پس این ابزار جدول مهاجرت را می‌سازد و به‌جای مسیر shadow، از `db push` و
 *   `migrate deploy` استفاده می‌کند که هر دو با موتور جاوااسکریپتی درست کار می‌کنند.
 *
 * برای ساختن «فایل مهاجرت تازه» پس از تغییر schema، روی سیستمی که اینترنت معمولی
 * دارد این فرمان را اجرا کنید (موتور کلاسیک به‌طور خودکار دانلود می‌شود):
 *   npx prisma migrate dev --name migration_name
 */
import { ensureAuthSecretInEnvFile, ensureEnvFile } from "./lib/env-file.mjs";
import {
  baselineMigrations,
  ensureMigrationsTable,
  getDatabaseStatus,
  removeDatabaseFiles,
  resolveDatabaseFilePath,
  runPrisma,
} from "./lib/db-status.mjs";

const COMMANDS = new Set(["setup", "check", "deploy", "reset"]);

/** ساخت فایل `.env` در صورت نبود، تا اجرا حتی روی سیستم تازه هم بی‌خطا باشد. */
function prepareEnvFile() {
  const env = ensureEnvFile({ create: true });

  if (env.created) {
    console.log("• فایل .env ساخته شد (شامل DATABASE_URL و AUTH_SECRET).");
  } else if (env.missingAuthSecret) {
    ensureAuthSecretInEnvFile();
    console.log("• کلید AUTH_SECRET به فایل .env اضافه شد.");
  }

  return env;
}

/** نمایش وضعیت خوانا از پایگاه داده. */
async function printStatus() {
  const status = await getDatabaseStatus();

  if (status.path) {
    console.log(`• فایل پایگاه داده: ${status.path}`);
  }

  if (!status.tables.length) {
    console.log("• پایگاه داده هنوز ساخته نشده است.");
    return status;
  }

  console.log(`• جدول‌های موجود: ${status.tables.length}`);

  if (status.ready) {
    console.log("• همهٔ ۱۷ جدول برنامه موجودند ✔");
  } else {
    console.log(`• جدول‌های غایب: ${status.missingTables.join(", ")}`);
  }

  if (status.migrations.length > 0) {
    console.log(`• مهاجرت‌های ثبت‌شده: ${status.migrations.join(", ")}`);
  }

  return status;
}

async function main() {
  const [command = "setup"] = process.argv.slice(2);

  if (!COMMANDS.has(command)) {
    console.error(`فرمان نامعتبر: ${command}\nفرمان‌های مجاز: ${[...COMMANDS].join(", ")}`);
    process.exit(1);
  }

  if (command === "check") {
    await printStatus();
    return;
  }

  prepareEnvFile();

  if (command === "reset") {
    const removedPath = removeDatabaseFiles();
    console.log(`• پایگاه دادهٔ قبلی پاک شد: ${removedPath}`);
  }

  await ensureMigrationsTable();

  if (command === "deploy") {
    const result = runPrisma(["migrate", "deploy", "--schema", "prisma/schema.prisma"]);

    if (!result.ok && result.hint) {
      console.error(`\n✖ اعمال مهاجرت‌ها انجام نشد.\n${result.hint}`);
      process.exit(1);
    }
  } else {
    // در محیط توسعه، ساختار پایگاه داده با schema هم‌گام می‌شود.
    const push = runPrisma(["db", "push", "--skip-generate", "--schema", "prisma/schema.prisma"]);

    if (!push.ok) {
      console.error(`\n✖ ساخت پایگاه داده انجام نشد.\n${push.hint ?? "خروجی بالا را ببینید."}`);
      process.exit(1);
    }

    const recorded = await baselineMigrations();

    if (recorded.length > 0) {
      console.log(`• ${recorded.length} مهاجرت به‌عنوان اعمال‌شده ثبت شد: ${recorded.join(", ")}`);
    }
  }

  const generate = runPrisma(["generate", "--schema", "prisma/schema.prisma"]);

  if (!generate.ok) {
    console.error(`\n✖ تولید کلاینت Prisma انجام نشد.\n${generate.hint ?? "خروجی بالا را ببینید."}`);
    process.exit(1);
  }

  const status = await getDatabaseStatus();
  const messages = {
    setup: "پایگاه داده آماده است. حالا `npm run dev:open` را اجرا کنید.",
    deploy: "همهٔ مهاجرت‌های موجود اعمال شد.",
    reset: "پایگاه داده از نو ساخته شد.",
  };

  if (command === "setup" || command === "reset") {
    console.log(
      `• جدول‌ها: ${status.tables.length}${status.ready ? " (همهٔ ۱۷ جدول برنامه) ✔" : ""}`,
    );
  }

  console.log(`\n✔ ${messages[command]}`);
}

main().catch((error) => {
  const filePath = (() => {
    try {
      return resolveDatabaseFilePath();
    } catch {
      return null;
    }
  })();

  console.error("\n✖ خطای غیرمنتظره در ابزار پایگاه داده:");
  console.error(error instanceof Error ? error.message : error);

  if (filePath) {
    console.error(`\nمسیر فایل پایگاه داده: ${filePath}`);
  }

  console.error(
    "راه‌حل پیشنهادی: `npm install` را اجرا کنید، سپس `npm run db:setup`.\n" +
      "اگر مشکل ادامه داشت، `npm run doctor` را اجرا کنید و خروجی آن را بفرستید.",
  );

  process.exit(1);
});
