/**
 * وضعیت پایگاه داده و کارهای مشترک روی آن — مشترک میان اسکریپت‌های پوشهٔ `scripts/`.
 *
 * جدول‌های اصلی برنامه از `schema.prisma` می‌آیند؛ اگر همهٔ این‌ها موجود باشند،
 * «پایگاه داده آماده است» و نیازی به `db push` نیست.
 */
import { spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { createClient } from "@libsql/client";

import { DEFAULT_DATABASE_URL, ENV_FILE_NAME, readEnvFile } from "./env-file.mjs";

/** جدول‌هایی که باید وجود داشته باشند تا پایگاه داده «آماده» شمرده شود. */
export const EXPECTED_TABLES = [
  "User",
  "Book",
  "BookNode",
  "Topic",
  "Question",
  "QuestionTopic",
  "QuestionAttempt",
  "PreviousSolvedEntry",
  "TeachingRecord",
  "TeachingGoal",
  "Exam",
  "ExamTopic",
  "ExamQuestion",
  "ExamAttempt",
  "ExamAnswer",
  "FutureExamPlan",
  "ReviewItem",
];

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

/**
 * آدرس پایگاه داده را تعیین می‌کند: ابتدا متغیر محیطی، بعد فایل `.env`، و در نهایت
 * مقدار پیش‌فرض پروژه.
 */
export function resolveDatabaseUrl(projectRoot = process.cwd()) {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  const values = readEnvFile(path.join(projectRoot, ENV_FILE_NAME));

  return values.DATABASE_URL || DEFAULT_DATABASE_URL;
}

/**
 * مسیر فایل پایگاه دادهٔ محلی؛ برای پایگاه دادهٔ شبکه‌ای `null` برمی‌گرداند.
 * مسیر همیشه مطلق می‌شود تا هر فرمانی (از هر پوشه‌ای) همان فایل را ببیند.
 */
export function resolveDatabaseFilePath(projectRoot = process.cwd()) {
  const url = resolveDatabaseUrl(projectRoot);

  if (!url.startsWith("file:")) {
    return null;
  }

  const filePath = url.slice("file:".length);

  return path.isAbsolute(filePath) ? filePath : path.resolve(projectRoot, filePath);
}

/** ساخت کلاینت libSQL برای همین پایگاه داده. */
export function createDatabaseClient(projectRoot = process.cwd()) {
  const filePath = resolveDatabaseFilePath(projectRoot);

  if (!filePath) {
    return createClient({ url: resolveDatabaseUrl(projectRoot) });
  }

  fs.mkdirSync(path.dirname(filePath), { recursive: true });

  return createClient({ url: `file:${filePath}` });
}

/** فهرست جدول‌های موجود در پایگاه داده. */
export async function listTables(client) {
  const result = await client.execute(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
  );

  return result.rows.map((row) => String(row.name));
}

/**
 * خواندن وضعیت کامل پایگاه داده.
 *
 * @returns {Promise<{ path: string | null, ready: boolean, tables: string[], missingTables: string[], users: number | null, migrations: string[], error: string | null }>}
 */
export async function getDatabaseStatus(projectRoot = process.cwd()) {
  const filePath = resolveDatabaseFilePath(projectRoot);
  const status = {
    path: filePath,
    ready: false,
    tables: [],
    missingTables: [],
    users: null,
    migrations: [],
    error: null,
  };

  // پایگاه دادهٔ فایل‌محور اگر فایلش نباشد، هنوز ساخته نشده است.
  if (filePath && !fs.existsSync(filePath)) {
    return status;
  }

  const client = createDatabaseClient(projectRoot);

  try {
    status.tables = await listTables(client);

    const tableSet = new Set(status.tables);
    status.missingTables = EXPECTED_TABLES.filter((table) => !tableSet.has(table));
    status.ready = status.missingTables.length === 0;

    if (tableSet.has("User")) {
      const result = await client.execute("SELECT COUNT(*) AS count FROM \"User\"");
      status.users = Number(result.rows[0]?.count ?? 0);
    }

    if (tableSet.has("_prisma_migrations")) {
      const result = await client.execute(
        'SELECT "migration_name" FROM "_prisma_migrations" WHERE "finished_at" IS NOT NULL ORDER BY "migration_name"',
      );
      status.migrations = result.rows.map((row) => String(row.migration_name));
    }
  } catch (error) {
    status.error = error instanceof Error ? error.message : String(error);
  } finally {
    client.close();
  }

  return status;
}

/** ساخت جدول `_prisma_migrations` (همان جدولی که خود Prisma می‌سازد). */
export async function ensureMigrationsTable(projectRoot = process.cwd()) {
  const filePath = resolveDatabaseFilePath(projectRoot);

  if (!filePath) {
    return;
  }

  const client = createDatabaseClient(projectRoot);

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
 * بگوییم این مهاجرت‌ها قبلاً اعمال شده‌اند؛ وگرنه بار بعد `db deploy` می‌خواهد
 * همان جدول‌ها را دوباره بسازد و خطای «جدول از قبل وجود دارد» می‌دهد.
 */
export async function baselineMigrations(projectRoot = process.cwd()) {
  const filePath = resolveDatabaseFilePath(projectRoot);
  const migrationsDirectory = path.join(projectRoot, "prisma", "migrations");

  if (!filePath || !fs.existsSync(migrationsDirectory)) {
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

  const client = createDatabaseClient(projectRoot);
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
      const now = new Date().toISOString();

      await client.execute({
        sql: `INSERT INTO "_prisma_migrations"
                ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count")
              VALUES (?, ?, ?, ?, NULL, NULL, ?, 1)`,
        args: [randomUUID(), checksum, now, folder, now],
      });

      recorded.push(folder);
    }
  } finally {
    client.close();
  }

  return recorded;
}

/** حذف فایل پایگاه دادهٔ محلی (برای `db:reset`). */
export function removeDatabaseFiles(projectRoot = process.cwd()) {
  const filePath = resolveDatabaseFilePath(projectRoot);

  if (!filePath) {
    throw new Error("این فرمان فقط برای پایگاه دادهٔ محلی SQLite کار می‌کند.");
  }

  for (const suffix of ["", "-journal", "-wal", "-shm"]) {
    fs.rmSync(`${filePath}${suffix}`, { force: true });
  }

  return filePath;
}

/**
 * مسیر فایل اجرایی Prisma CLI.
 *
 * ترجیح می‌دهیم خودِ فایل جاوااسکریپتی Prisma را با `node` اجرا کنیم تا وابسته به
 * `npx` و پوستهٔ ویندوز نباشیم (روی ویندوز، اجرای `npx.cmd` از داخل اسکریپت‌ها
 * شکننده است). اگر فایل پیدا نشد، به `npx` برمی‌گردیم.
 */
export function resolvePrismaCli(projectRoot = process.cwd()) {
  const localCli = path.join(projectRoot, "node_modules", "prisma", "build", "index.js");

  return fs.existsSync(localCli) ? localCli : null;
}

/**
 * اجرای یک فرمان Prisma با پیام‌های خطای فارسی.
 *
 * @param {string[]} args آرگومان‌های Prisma، مثلاً `["db", "push", "--skip-generate"]`
 * @param {{ projectRoot?: string, quiet?: boolean }} options
 * @returns {{ ok: boolean, output: string, hint: string | null }}
 */
export function runPrisma(args, { projectRoot = process.cwd(), quiet = false } = {}) {
  const prismaCli = resolvePrismaCli(projectRoot);
  const command = prismaCli ? process.execPath : "npx";
  const commandArgs = prismaCli ? [prismaCli, ...args] : ["prisma", ...args];

  const result = spawnSync(command, commandArgs, {
    cwd: projectRoot,
    encoding: "utf8",
    shell: !prismaCli && process.platform === "win32",
    env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL || resolveDatabaseUrl(projectRoot) },
  });

  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  const ok = result.status === 0;

  if (!quiet && output.trim()) {
    process.stdout.write(output.endsWith("\n") ? output : `${output}\n`);
  }

  return { ok, output, hint: ok ? null : describePrismaFailure(output) };
}

/** تبدیل خطاهای فنی Prisma به راهنمای فارسی و قابل‌فهم. */
export function describePrismaFailure(output) {
  if (/binaries\.prisma\.sh|failed to download|ENOTFOUND|ECONNRESET|socket disconnected|TLS/i.test(output)) {
    return [
      "دانلود موتور Prisma انجام نشد (شبکه یا فیلتر اینترنت).",
      "این پروژه برای همین شرایط تنظیم شده است: بدون نیاز به باینری بومی کار می‌کند.",
      "راه‌حل: فایل .env را بسازید (npm run init:env) و دوباره npm run db:setup را اجرا کنید.",
      "اگر باز هم تکرار شد، بررسی کنید فایل node_modules کامل نصب شده باشد (npm install).",
    ].join("\n");
  }

  if (/P1003|no such file|unable to open database file/i.test(output)) {
    return [
      "فایل پایگاه داده پیدا نشد یا پوشهٔ آن ساخته نشده است.",
      "راه‌حل: npm run db:setup را اجرا کنید تا فایل و جدول‌ها ساخته شوند.",
    ].join("\n");
  }

  if (/Unknown argument|unknown or unexpected option/i.test(output)) {
    return [
      "نسخهٔ ابزار Prisma با این فرمان سازگار نیست.",
      "راه‌حل: npm install را اجرا کنید تا نسخهٔ درست نصب شود، بعد npm run db:setup.",
    ].join("\n");
  }

  if (/P2002/i.test(output)) {
    return "این رکورد از قبل وجود دارد (مقدار یکتا تکراری است).";
  }

  if (/Environment variable not found|DATABASE_URL/i.test(output)) {
    return "متغیر DATABASE_URL پیدا نشد. راه‌حل: npm run init:env و بعد npm run db:setup.";
  }

  return null;
}
