import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { DEFAULT_DATABASE_URL, parseEnvFileContent } from "./env-parse.ts";

/**
 * آزمون‌های تجزیهٔ فایل `.env` (`lib/env-parse.ts`).
 *
 * هدف: مطمئن شویم قالب‌هایی که کاربران واقعی می‌نویسند (با فاصله، نقل‌قول، کامنت و
 * علامت تساوی داخل مقدار) درست خوانده می‌شوند و خطاهای رایج هم پیام فارسی می‌گیرند.
 */
describe("parseEnvFileContent", () => {
  it("کلیدهای ساده را می‌خواند", () => {
    const { values, warnings } = parseEnvFileContent('DATABASE_URL="file:./prisma/dev.db"\nAUTH_SECRET=abc123');

    assert.equal(values.DATABASE_URL, "file:./prisma/dev.db");
    assert.equal(values.AUTH_SECRET, "abc123");
    assert.deepEqual(warnings, []);
  });

  it("علامت تساوی داخل مقدار را حفظ می‌کند (کلیدهای base64)", () => {
    const { values } = parseEnvFileContent("AUTH_SECRET=3/LFmJer9tQCEeqBReL7ees1Je0n24nOT05hEn0bP88=");

    assert.equal(values.AUTH_SECRET, "3/LFmJer9tQCEeqBReL7ees1Je0n24nOT05hEn0bP88=");
  });

  it("فاصله‌های اضافی و نقل‌قول تک را نادیده می‌گیرد", () => {
    const { values } = parseEnvFileContent("  DATABASE_URL = 'file:./dev.db'  ");

    assert.equal(values.DATABASE_URL, "file:./dev.db");
  });

  it("کامنت‌ها و خط‌های خالی را رد می‌کند", () => {
    const { values, warnings } = parseEnvFileContent("# توضیح\n\nDATABASE_URL=file:x.db\n   \n# پایان");

    assert.deepEqual(values, { DATABASE_URL: "file:x.db" });
    assert.deepEqual(warnings, []);
  });

  it("برای خط بدون علامت تساوی هشدار می‌دهد", () => {
    const { warnings } = parseEnvFileContent("DATABASE_URL\nAUTH_SECRET=ok");

    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /KEY=VALUE/);
  });

  it("برای نام متغیر دارای فاصله هشدار می‌دهد و آن را نادیده می‌گیرد", () => {
    const { values, warnings } = parseEnvFileContent("MY KEY=value\nAUTH_SECRET=ok");

    assert.equal(values["MY KEY"], undefined);
    assert.equal(values.AUTH_SECRET, "ok");
    assert.equal(warnings.length, 1);
  });

  it("برای متغیر تکراری، آخرین مقدار را نگه می‌دارد", () => {
    const { values } = parseEnvFileContent("AUTH_SECRET=first\nAUTH_SECRET=second");

    assert.equal(values.AUTH_SECRET, "second");
  });
});

describe("DEFAULT_DATABASE_URL", () => {
  it("به فایل پایگاه دادهٔ محلی پروژه اشاره می‌کند", () => {
    assert.equal(DEFAULT_DATABASE_URL, "file:./prisma/dev.db");
  });
});
