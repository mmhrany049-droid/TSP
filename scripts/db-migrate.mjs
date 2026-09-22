#!/usr/bin/env node
/**
 * ابزار پایگاه دادهٔ TSP.
 *
 *   npm run db:setup     → ساخت/هم‌گام‌سازی پایگاه دادهٔ محلی + تولید کلاینت Prisma
 *   npm run db:deploy    → اعمال مهاجرت‌های موجود در prisma/migrations
 *   npm run db:reset     → پاک‌کردن پایگاه دادهٔ محلی و ساخت دوبارهٔ آن (بی‌بازگشت)
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
import { spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { createClient } from "@libsql/client";
import "dotenv/config";

const MIGRATIONS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "checksum" TEXT NOT NULL,
  "finished_at" DATETIME,
  "migration_name" TEXT NOT NULL,
  "logs" TEXT,
  "rolled_back_at" DATETIME,
  "started_at" DATETIME NOT NULL DEFAULT current_timestamp,
  "applied_steps_count" INTEGER NOT NULL DEFAULT 0
)`;

const COMMANDS = new Set(["setup", "deploy", "reset"]);

/** مسیر فایل پایگاه دادهٔ محلی؛ برای پایگاه دادهٔ شبکه‌ای `null` است. */
function resolveDatabasePath() {
  const url = process.env.DATABASE_URL ?? "file:./prisma/dev.db";

  if (!url.startsWith("file:")) {
    return null;
  }

  const filePath = url.slice("file:".length);

  return path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
}

/** ساخت جدول `_prisma_migrations` (همان جدولی که خود Prisma می‌سازد). */
async function ensureMigrationsTable() {
  const databasePath = resolveDatabasePath();

  if (!databasePath) {
    return;
  }

  fs.mkdirSync(path.dirname(databasePath), { recursive: true });

  const client = createClient({ url: `file:${databasePath}` });

  try {
    await client.execute(MIGRATIONS_TABLE_SQL);
  } finally {
    client.close();
  }
}

/**
 * ثبت مهاجرت‌های موجود به‌عنوان «اعمال‌شده».
 *
 * چون در محیط توسعه ساختار پایگاه داده با `db push` ساخته می‌شود، باید به Prisma
 * بگوییم این مهاجرت‌ها قبلاً اعمال شده‌اند؛ وگرنه بار بعد `db:deploy` می‌خواهد
 * همان جدول‌ها را دوباره بسازد و خطای «جدول از قبل وجود دارد» می‌دهد.
 */
async function baselineMigrations() {
  const databasePath = resolveDatabasePath();
  const migrationsDirectory = path.join(process.cwd(), "prisma", "migrations");

  if (!databasePath || !fs.existsSync(migrationsDirectory)) {
    return [];
  }

  const folders = fs
    .readdirSync(migrationsDirectory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  if (folders.length === 0) {
    return [];
  }

  const client = createClient({ url: `file:${databasePath}` });
  const recorded = [];

  try {
    for (const folder of folders) {
      const sqlPath = path.join(migrationsDirectory, folder, "migration.sql");

      if (!fs.existsSync(sqlPath)) {
        continue;
      }

      const already = await client.execute({
        sql: 'SELECT 1 FROM "_prisma_migrations" WHERE "migration_name" = ? AND "finished_at" IS NOT NULL',
        args: [folder],
      });

      if (already.rows.length > 0) {
        continue;
      }

      const checksum = createHash("sha256").update(fs.readFileSync(sqlPath)).digest("hex");

      await client.execute({
        sql: `INSERT INTO "_prisma_migrations"
                ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count")
              VALUES (?, ?, ?, ?, NULL, NULL, ?, 1)`,
        args: [randomUUID(), checksum, new Date().toISOString(), folder, new Date().toISOString()],
      });

      recorded.push(folder);
    }
  } finally {
    client.close();
  }

  return recorded;
}

/** ساخت پایگاه دادهٔ تازه: فایل قدیمی حذف می‌شود. */
function removeDatabaseFiles() {
  const databasePath = resolveDatabasePath();

  if (!databasePath) {
    throw new Error("db:reset فقط برای پایگاه دادهٔ محلی SQLite کار می‌کند");
  }

  for (const suffix of ["", "-journal", "-wal", "-shm"]) {
    fs.rmSync(`${databasePath}${suffix}`, { force: true });
  }
}

/** اجرای یک فرمان npx روی همهٔ سیستم‌عامل‌ها. */
function run(args) {
  const result = spawnSync("npx", args, {
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

async function main() {
  const [command = "setup"] = process.argv.slice(2);

  if (!COMMANDS.has(command)) {
    console.error(`فرمان نامعتبر: ${command}\nفرمان‌های مجاز: ${[...COMMANDS].join(", ")}`);
    process.exit(1);
  }

  if (command === "reset") {
    removeDatabaseFiles();
    console.log("پایگاه دادهٔ محلی پاک شد.");
  }

  await ensureMigrationsTable();

  if (command === "deploy") {
    run(["prisma", "migrate", "deploy"]);
  } else {
    // در محیط توسعه، ساختار پایگاه داده با schema هم‌گام می‌شود
    run(["prisma", "db", "push", "--skip-generate"]);

    const recorded = await baselineMigrations();

    if (recorded.length > 0) {
      console.log(`\n${recorded.length} مهاجرت به‌عنوان اعمال‌شده ثبت شد: ${recorded.join(", ")}`);
    }
  }

  run(["prisma", "generate"]);

  const messages = {
    setup: "پایگاه داده آماده است. می‌توانید `npm run dev` را اجرا کنید.",
    deploy: "همهٔ مهاجرت‌های موجود اعمال شد.",
    reset: "پایگاه داده از نو ساخته شد.",
  };

  console.log(`\n✔ ${messages[command]}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
