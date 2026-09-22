#!/usr/bin/env node
/**
 * آماده‌سازی خودکار پروژه پیش از اجرا (dev و build).
 *
 * چه می‌کند؟
 *   ۱. نسخهٔ Node.js را بررسی می‌کند (حداقل ۲۰.۹).
 *   ۲. اگر فایل `.env` نباشد، آن را همراه با `AUTH_SECRET` تصادفی می‌سازد.
 *   ۳. اگر کلاینت Prisma تولید نشده باشد، آن را می‌سازد.
 *   ۴. اگر پایگاه دادهٔ محلی نباشد یا جدول‌هایش کامل نباشند، `db push` و تولید
 *      کلاینت را انجام می‌دهد (همان کار `db:setup`، ولی فقط وقتی لازم باشد).
 *
 * اصل مهم: این اسکریپت **هرگز نباید اجرای برنامه را متوقف کند**.
 *   اگر ساخت دیتابیس یا تولید کلاینت شکست خورد، فقط یک پیام فارسی چاپ می‌شود و
 *   برنامه بالا می‌آید (صفحهٔ راهنما به کاربر می‌گوید چه کاری کند). به‌این‌ترتیب
 *   کاربر به‌جای «صفحهٔ سفید» یا خطای خشک، راهنمای عملی می‌بیند.
 *
 * استفاده:
 *   node scripts/prepare-project.mjs             (آماده‌سازی معمول)
 *   node scripts/prepare-project.mjs --no-db     (فقط .env و کلاینت Prisma، برای build)
 */
import fs from "node:fs";
import path from "node:path";

import {
  baselineMigrations,
  ensureMigrationsTable,
  getDatabaseStatus,
  resolvePrismaCli,
  runPrisma,
} from "./lib/db-status.mjs";
import {
  DEFAULT_DATABASE_URL,
  ensureAuthSecretInEnvFile,
  ensureEnvFile,
  upsertEnvVariable,
} from "./lib/env-file.mjs";

const PROJECT_ROOT = process.cwd();
const MIN_NODE_MAJOR = 20;
const MIN_NODE_MINOR = 9;

/** نسخهٔ Node.js باید حداقل ۲۰.۹ باشد (نیاز Next.js 15). */
function checkNodeVersion() {
  const [major, minor] = process.versions.node.split(".").map(Number);

  if (major > MIN_NODE_MAJOR || (major === MIN_NODE_MAJOR && minor >= MIN_NODE_MINOR)) {
    return true;
  }

  console.error(
    [
      "",
      "✖ نسخهٔ Node.js شما قدیمی است.",
      `  نسخهٔ فعلی: ${process.versions.node} — نسخهٔ لازم: ۲۰.۹ یا بالاتر.`,
      "  راه‌حل: از سایت nodejs.org نسخهٔ LTS را نصب کنید و ترمینال را دوباره باز کنید.",
      "",
    ].join("\n"),
  );

  return false;
}

/** گام «متغیرهای محیطی». */
function stepEnvFile() {
  const env = ensureEnvFile({ create: true });

  if (env.created) {
    console.log("• فایل .env ساخته شد (DATABASE_URL + AUTH_SECRET تصادفی).");
    return true;
  }

  if (env.missingAuthSecret) {
    // حالت رایج: کاربر .env را از .env.example کپی کرده ولی AUTH_SECRET را پر نکرده است.
    ensureAuthSecretInEnvFile();
    console.log("• کلید AUTH_SECRET در فایل .env تنظیم شد.");
    return true;
  }

  if (env.missingDatabaseUrl) {
    upsertEnvVariable(env.path, "DATABASE_URL", DEFAULT_DATABASE_URL);
    console.log("• مقدار DATABASE_URL به فایل .env اضافه شد.");
    return true;
  }

  console.log("• فایل .env موجود است.");

  return true;
}

/** گام «کلاینت Prisma». */
function stepPrismaClient() {
  const clientEntry = path.join(PROJECT_ROOT, "node_modules", ".prisma", "client", "index.js");

  if (fs.existsSync(clientEntry) && fs.existsSync(resolvePrismaCli() ?? "")) {
    return true;
  }

  if (!fs.existsSync(resolvePrismaCli() ?? "")) {
    console.warn(
      [
        "",
        "⚠ بستهٔ Prisma نصب نشده است.",
        "  راه‌حل: `npm install` را اجرا کنید.",
        "",
      ].join("\n"),
    );

    return false;
  }

  console.log("• کلاینت Prisma در حال ساخت است…");
  const result = runPrisma(["generate", "--schema", "prisma/schema.prisma"], { quiet: true });

  if (!result.ok) {
    console.warn(
      [
        "",
        "⚠ ساخت کلاینت Prisma انجام نشد؛ برنامه بالا می‌آید ولی داده‌ها کار نمی‌کنند.",
        result.hint ?? "  راه‌حل: `npm run db:setup` را اجرا کنید.",
        "",
      ].join("\n"),
    );

    return false;
  }

  return true;
}

/** گام «پایگاه داده»: فقط اگر نبود یا ناقص بود، ساخته می‌شود. */
async function stepDatabase() {
  const before = await getDatabaseStatus(PROJECT_ROOT);

  if (before.ready) {
    console.log(`• پایگاه دادهٔ محلی آماده است (${before.tables.length} جدول).`);
    return true;
  }

  console.log(
    before.tables.length === 0
      ? "• پایگاه دادهٔ محلی ساخته نشده است؛ در حال ساخت…"
      : `• پایگاه داده ناقص است (غایب: ${before.missingTables.join(", ")}); در حال هم‌گام‌سازی…`,
  );

  await ensureMigrationsTable(PROJECT_ROOT);

  const push = runPrisma(["db", "push", "--skip-generate", "--schema", "prisma/schema.prisma"], {
    quiet: true,
  });

  if (!push.ok) {
    console.warn(
      [
        "",
        "⚠ ساخت پایگاه داده انجام نشد؛ برنامه بالا می‌آید و صفحهٔ راهنما نمایش داده می‌شود.",
        push.hint ?? "  • خروجی کامل: `npm run db:setup`",
        "",
      ].join("\n"),
    );

    return false;
  }

  const recorded = await baselineMigrations(PROJECT_ROOT);

  if (recorded.length > 0) {
    console.log(`• ${recorded.length} مهاجرت ثبت شد.`);
  }

  const createClient = runPrisma(["generate", "--schema", "prisma/schema.prisma"], { quiet: true });

  if (!createClient.ok) {
    console.warn("⚠ تولید کلاینت Prisma انجام نشد؛ `npm run db:setup` را اجرا کنید.");
    return false;
  }

  const after = await getDatabaseStatus(PROJECT_ROOT);
  console.log(`• پایگاه داده ساخته شد (${after.tables.length} جدول). ${after.ready ? "✔" : ""}`);

  return after.ready;
}

async function main() {
  const args = process.argv.slice(2);
  const skipDatabase = args.includes("--no-db");

  if (!checkNodeVersion()) {
    process.exit(1);
  }

  console.log("\nآماده‌سازی پروژهٔ TSP:");

  stepEnvFile();
  stepPrismaClient();

  if (!skipDatabase) {
    await stepDatabase();
  }

  console.log("");
}

main().catch((error) => {
  // شکست آماده‌سازی هرگز نباید جلوی اجرای برنامه را بگیرد.
  console.warn(
    [
      "",
      "⚠ آماده‌سازی خودکار با خطا روبه‌رو شد (برنامه با همان وضعیت فعلی اجرا می‌شود):",
      `  ${error instanceof Error ? error.message : error}`,
      "  • برای راهنمای گام‌به‌گام: npm run doctor",
      "",
    ].join("\n"),
  );
});
