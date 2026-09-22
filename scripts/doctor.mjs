#!/usr/bin/env node
/**
 * عیب‌یابی پروژه: `npm run doctor`
 *
 * این ابزار «سلامت» پروژه را گام‌به‌گام بررسی می‌کند و برای هر مشکل، راه‌حل فارسی
 * و عملی می‌دهد. مناسب وقتی برنامه بالا نمی‌آید، صفحهٔ سفید می‌بینید یا خطای
 * پایگاه داده می‌گیرید. خروجی آن برای فرستادن به پشتیبانی هم مناسب است.
 */
import fs from "node:fs";
import path from "node:path";

import { getDatabaseStatus, resolveDatabaseFilePath, resolvePrismaCli } from "./lib/db-status.mjs";
import { DEFAULT_DATABASE_URL, ENV_FILE_NAME, readEnvFile } from "./lib/env-file.mjs";

const PROJECT_ROOT = process.cwd();
const checks = [];

/** ثبت نتیجهٔ یک بررسی. */
function record(title, status, details = [], hints = []) {
  checks.push({ title, status, details, hints });
}

/** بررسی نسخهٔ Node.js. */
function checkNode() {
  const [major, minor] = process.versions.node.split(".").map(Number);
  const isSupported = major > 20 || (major === 20 && minor >= 9);

  record(
    "نسخهٔ Node.js",
    isSupported ? "ok" : "error",
    [`نسخهٔ فعلی: ${process.versions.node} (نسخهٔ لازم: ۲۰.۹ یا بالاتر)`],
    isSupported ? [] : ["از nodejs.org نسخهٔ LTS را نصب کنید و ترمینال را دوباره باز کنید."],
  );
}

/** بررسی نصب بودن بسته‌ها. */
function checkDependencies() {
  const required = ["next", "react", "prisma", "@prisma/client", "next-auth", "bcryptjs", "zod"];
  const missing = required.filter(
    (name) => !fs.existsSync(path.join(PROJECT_ROOT, "node_modules", name, "package.json")),
  );

  record(
    "بسته‌های npm",
    missing.length === 0 ? "ok" : "error",
    missing.length === 0 ? [`${required.length} بستهٔ اصلی نصب است`] : [`نصب‌نشده: ${missing.join(", ")}`],
    missing.length === 0 ? [] : ["در پوشهٔ پروژه `npm install` را اجرا کنید."],
  );
}

/** بررسی تولید شدن کلاینت Prisma. */
function checkPrismaClient() {
  const clientEntry = path.join(PROJECT_ROOT, "node_modules", ".prisma", "client", "index.js");
  const hasClient = fs.existsSync(clientEntry);
  const hasCli = Boolean(resolvePrismaCli());

  record(
    "کلاینت Prisma",
    hasClient && hasCli ? "ok" : "error",
    [
      hasClient ? "کلاینت تولید شده است" : "کلاینت تولید نشده است (پوشهٔ node_modules/.prisma)",
      hasCli ? "ابزار Prisma CLI در دسترس است" : "ابزار Prisma CLI پیدا نشد",
    ],
    hasClient && hasCli ? [] : ["`npm install` و بعد `npm run db:setup` را اجرا کنید."],
  );
}

/** بررسی فایل .env و کلیدهای آن. */
function checkEnvFile() {
  const filePath = path.join(PROJECT_ROOT, ENV_FILE_NAME);

  if (!fs.existsSync(filePath)) {
    record(
      "فایل .env",
      "error",
      ["فایل وجود ندارد"],
      ["`npm run init:env` را اجرا کنید (یا `npm run db:setup` که خودش می‌سازد)."],
    );

    return;
  }

  const values = readEnvFile(filePath);
  const secretLength = values.AUTH_SECRET?.length ?? 0;
  const details = [
    "فایل موجود است",
    values.DATABASE_URL ? `DATABASE_URL: ${values.DATABASE_URL}` : "DATABASE_URL: تنظیم نشده (پیش‌فرض استفاده می‌شود)",
    secretLength >= 16 ? `AUTH_SECRET: تنظیم شده (${secretLength} نویسه)` : "AUTH_SECRET: تنظیم نشده",
  ];

  const hasProblem = !values.DATABASE_URL || secretLength < 16;

  record("فایل .env", hasProblem ? "warn" : "ok", details, [
    ...(secretLength < 16 ? ["`npm run init:env` را اجرا کنید تا AUTH_SECRET ساخته شود."] : []),
    ...(values.DATABASE_URL ? [] : [`راه‌حل سریع: خط DATABASE_URL="${DEFAULT_DATABASE_URL}" را به .env اضافه کنید.`]),
  ]);
}

/** بررسی پایگاه داده. */
async function checkDatabase() {
  const status = await getDatabaseStatus(PROJECT_ROOT);
  const filePath = resolveDatabaseFilePath(PROJECT_ROOT);

  if (status.error) {
    record("پایگاه داده", "error", [`خطا در خواندن: ${status.error}`], [
      "`npm run db:setup` را اجرا کنید تا فایل و جدول‌ها از نو ساخته شوند.",
    ]);

    return;
  }

  if (status.tables.length === 0) {
    record(
      "پایگاه داده",
      "error",
      [filePath ? `فایل ساخته نشده: ${filePath}` : "مسیر فایل مشخص نیست"],
      ["`npm run db:setup` را اجرا کنید."],
    );

    return;
  }

  record(
    "پایگاه داده",
    status.ready ? "ok" : "warn",
    [
      filePath ? `فایل: ${filePath}` : "پایگاه دادهٔ شبکه‌ای",
      `جدول‌ها: ${status.tables.length}`,
      status.ready ? "همهٔ ۱۷ جدول برنامه موجودند" : `غایب: ${status.missingTables.join(", ")}`,
      status.users === null ? "تعداد کاربران: نامشخص" : `کاربران ثبت‌شده: ${status.users}`,
      status.migrations.length > 0 ? `مهاجرت‌ها: ${status.migrations.join(", ")}` : "مهاجرتی ثبت نشده",
    ],
    status.ready ? [] : ["`npm run db:setup` را اجرا کنید تا جدول‌های غایب ساخته شوند."],
  );

  if (status.ready && status.users === 0) {
    record("حساب کاربری", "info", ["هنوز هیچ کاربری ثبت نشده است"], [
      "برنامه را باز کنید و از صفحهٔ «ثبت‌نام» حساب خودتان را بسازید.",
    ]);
  }
}

/** بررسی فایل‌های قلم (اگر نباشند، برنامه کرش نمی‌کند و قلم پیش‌فرض سیستم استفاده می‌شود). */
function checkFonts() {
  const fontsDirectory = path.join(PROJECT_ROOT, "public", "fonts");
  const fonts = ["vazirmatn-arabic-wght-normal.woff2", "vazirmatn-latin-wght-normal.woff2"];
  const missing = fonts.filter((font) => !fs.existsSync(path.join(fontsDirectory, font)));

  record(
    "قلم‌های محلی",
    missing.length === 0 ? "ok" : "warn",
    missing.length === 0 ? ["قلم وزیرمتن موجود است"] : [`غایب: ${missing.join(", ")}`],
    missing.length === 0 ? [] : ["برنامه کار می‌کند و فقط از قلم پیش‌فرض سیستم استفاده می‌کند."],
  );
}

/** بررسی آزاد بودن پورت پیش‌فرض. */
async function checkPort() {
  const net = await import("node:net");

  const isBusy = await new Promise((resolve) => {
    const server = net.createServer();

    server.once("error", () => resolve(true));
    server.once("listening", () => server.close(() => resolve(false)));
    server.listen(3000, "127.0.0.1");
  });

  record(
    "پورت ۳۰۰۰",
    isBusy ? "warn" : "ok",
    [isBusy ? "این پورت در حال استفاده است" : "آزاد است"],
    isBusy ? ["اگر برنامهٔ دیگری روی ۳۰۰۰ کار می‌کند، Next خودش پورت بعدی را انتخاب می‌کند."] : [],
  );
}

/** چاپ گزارش نهایی. */
function printReport() {
  const icons = { ok: "✔", warn: "⚠", error: "✖", info: "ℹ" };
  const counts = { ok: 0, warn: 0, error: 0, info: 0 };

  console.log("\n═══ گزارش سلامت پروژهٔ TSP ═══\n");

  for (const check of checks) {
    counts[check.status] += 1;
    console.log(`${icons[check.status]} ${check.title}`);

    for (const detail of check.details) {
      console.log(`    ${detail}`);
    }

    for (const hint of check.hints) {
      console.log(`    → ${hint}`);
    }

    console.log("");
  }

  console.log("─── خلاصه ───");
  console.log(`✔ سالم: ${counts.ok}   ⚠ هشدار: ${counts.warn}   ✖ خطا: ${counts.error}`);
  console.log(
    counts.error === 0
      ? "\nنتیجه: پروژه آمادهٔ اجراست. دستور `npm run dev:open` را اجرا کنید.\n"
      : "\nنتیجه: ابتدا موارد بالا را برطرف کنید، بعد `npm run db:setup` و `npm run dev:open`.\n",
  );

  return counts.error;
}

async function main() {
  checkNode();
  checkDependencies();
  checkPrismaClient();
  checkEnvFile();
  await checkDatabase();
  checkFonts();
  await checkPort();

  process.exitCode = printReport() > 0 ? 1 : 0;
}

main().catch((error) => {
  console.error("✖ اجرای عیب‌یابی ممکن نشد:", error instanceof Error ? error.message : error);
  process.exit(1);
});
