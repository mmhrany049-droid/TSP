#!/usr/bin/env node
/**
 * ساخت یا اصلاح فایل `.env`.
 *
 *   npm run init:env           → اگر .env نبود می‌سازد و AUTH_SECRET را پر می‌کند
 *   npm run init:env -- --force → کلید AUTH_SECRET را با مقدار تازه جایگزین می‌کند
 *
 * توجه: با تغییر AUTH_SECRET، همهٔ کوکی‌های نشست فعلی باطل می‌شوند و کاربران باید
 * دوباره وارد شوند (داده‌های پایگاه داده دست‌نخورده می‌مانند).
 */
import { readEnvFile, ensureEnvFile, generateAuthSecret, upsertEnvVariable, DEFAULT_DATABASE_URL } from "./lib/env-file.mjs";

const force = process.argv.includes("--force");

const env = ensureEnvFile({ create: true });

if (env.created) {
  console.log(`✔ فایل .env ساخته شد: ${env.path}`);
  console.log("  • DATABASE_URL و AUTH_SECRET مقدار گرفتند.");
  process.exit(0);
}

console.log(`• فایل .env موجود است: ${env.path}`);

let changed = false;

if (env.missingDatabaseUrl) {
  upsertEnvVariable(env.path, "DATABASE_URL", DEFAULT_DATABASE_URL);
  console.log("  • DATABASE_URL اضافه شد.");
  changed = true;
}

if (force) {
  const secret = generateAuthSecret();
  upsertEnvVariable(env.path, "AUTH_SECRET", secret);
  console.log("  • AUTH_SECRET با مقدار تازه جایگزین شد (کاربران باید دوباره وارد شوند).");
  changed = true;
} else if (env.missingAuthSecret) {
  upsertEnvVariable(env.path, "AUTH_SECRET", generateAuthSecret());
  console.log("  • AUTH_SECRET ساخته و اضافه شد.");
  changed = true;
} else {
  console.log("  • AUTH_SECRET از قبل تنظیم شده است.");
}

if (!readEnvFile(env.path).AUTH_SECRET) {
  console.error("✖ نوشتن AUTH_SECRET ممکن نشد؛ دسترسی نوشتن به فایل .env را بررسی کنید.");
  process.exit(1);
}

console.log(changed ? "\n✔ فایل .env آماده است." : "\n✔ نیازی به تغییر نبود.");
