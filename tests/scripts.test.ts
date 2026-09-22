import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";

import { browserOpenCommand, extractUrl } from "../scripts/dev.mjs";
import {
  buildEnvFileContent,
  ensureAuthSecretInEnvFile,
  ensureEnvFile,
  generateAuthSecret,
  readEnvFile,
  upsertEnvVariable,
} from "../scripts/lib/env-file.mjs";

/**
 * آزمون‌های ماژول‌های راه‌اندازی (پوشهٔ `scripts/`).
 *
 * این‌ها همان چیزهایی هستند که کاربر روی ویندوز هنگام `npm install` و
 * `npm run dev:open` اجرا می‌کند؛ پس باید رفتارشان قطعی و بی‌خطا باشد.
 */

let temporaryDirectory = "";

before(() => {
  temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "tsp-scripts-"));
});

after(() => {
  fs.rmSync(temporaryDirectory, { recursive: true, force: true });
});

describe("generateAuthSecret", () => {
  it("کلیدهای بلند و یکتا می‌سازد", () => {
    const first = generateAuthSecret();
    const second = generateAuthSecret();

    assert.ok(first.length >= 32, "کلید باید به‌اندازهٔ کافی بلند باشد");
    assert.notEqual(first, second);
  });
});

describe("buildEnvFileContent", () => {
  it("هر دو کلید لازم را دارد و قالبش با خواننده سازگار است", () => {
    const values = readEnvFile(writeTempEnv("template.env", buildEnvFileContent())) as Record<string, string>;

    assert.equal(values.DATABASE_URL, "file:./prisma/dev.db");
    assert.ok((values.AUTH_SECRET ?? "").length >= 32);
  });
});

describe("ensureEnvFile", () => {
  it("اگر فایل نباشد می‌سازد", () => {
    const directory = fs.mkdtempSync(path.join(temporaryDirectory, "create-"));
    const result = ensureEnvFile({ projectRoot: directory, create: true });

    assert.equal(result.created, true);
    assert.equal(fs.existsSync(result.path), true);

    const values = readEnvFile(result.path) as Record<string, string>;
    assert.ok(values.AUTH_SECRET);
  });

  it("فایل موجود را بازنویسی نمی‌کند", () => {
    const directory = fs.mkdtempSync(path.join(temporaryDirectory, "keep-"));
    const filePath = path.join(directory, ".env");

    fs.writeFileSync(filePath, 'AUTH_SECRET="my-own-secret-value-1234"\n', "utf8");

    const result = ensureEnvFile({ projectRoot: directory, create: true });

    assert.equal(result.created, false);
    assert.equal((readEnvFile(filePath) as Record<string, string>).AUTH_SECRET, "my-own-secret-value-1234");
  });

  it("نبود AUTH_SECRET را تشخیص می‌دهد", () => {
    const directory = fs.mkdtempSync(path.join(temporaryDirectory, "missing-"));
    fs.writeFileSync(path.join(directory, ".env"), 'DATABASE_URL="file:./prisma/dev.db"\n', "utf8");

    const result = ensureEnvFile({ projectRoot: directory, create: true });

    assert.equal(result.created, false);
    assert.equal(result.missingAuthSecret, true);
  });
});

describe("ensureAuthSecretInEnvFile", () => {
  it("کلید نامعتبر (کوتاه) را با کلید تازه جایگزین می‌کند", () => {
    const directory = fs.mkdtempSync(path.join(temporaryDirectory, "short-"));
    const filePath = path.join(directory, ".env");

    fs.writeFileSync(filePath, 'AUTH_SECRET="short"\nDATABASE_URL="file:./prisma/dev.db"\n', "utf8");

    const result = ensureAuthSecretInEnvFile(directory);

    assert.equal(result.changed, true);
    assert.ok(result.secret.length >= 32);
    // بقیهٔ خطوط باید دست‌نخورده بمانند
    assert.equal((readEnvFile(filePath) as Record<string, string>).DATABASE_URL, "file:./prisma/dev.db");
  });

  it("کلید معتبر را تغییر نمی‌دهد", () => {
    const directory = fs.mkdtempSync(path.join(temporaryDirectory, "valid-"));
    const filePath = path.join(directory, ".env");
    const secret = "a".repeat(40);

    fs.writeFileSync(filePath, `AUTH_SECRET="${secret}"\n`, "utf8");

    const result = ensureAuthSecretInEnvFile(directory);

    assert.equal(result.changed, false);
    assert.equal((readEnvFile(filePath) as Record<string, string>).AUTH_SECRET, secret);
  });
});

describe("upsertEnvVariable", () => {
  it("متغیر موجود را جایگزین و متغیر تازه را اضافه می‌کند", () => {
    const filePath = writeTempEnv("upsert.env", "A=B\nAUTH_SECRET=old\n");

    upsertEnvVariable(filePath, "AUTH_SECRET", "new-value");
    upsertEnvVariable(filePath, "DATABASE_URL", "file:./prisma/dev.db");

    const values = readEnvFile(filePath) as Record<string, string>;

    assert.equal(values.A, "B");
    assert.equal(values.AUTH_SECRET, "new-value");
    assert.equal(values.DATABASE_URL, "file:./prisma/dev.db");
  });
});

describe("extractUrl", () => {
  it("آدرس محلی را از خروجی Next.js بیرون می‌کشد", () => {
    const output = Buffer.from("   ▲ Next.js 15.5.25\n   - Local:        http://localhost:3000\n");

    assert.equal(extractUrl(output), "http://localhost:3000");
  });

  it("پورت غیرپیش‌فرض را هم تشخیص می‌دهد", () => {
    const output = Buffer.from("   - Local:        http://localhost:3001\n");

    assert.equal(extractUrl(output), "http://localhost:3001");
  });

  it("اگر آدرسی در خروجی نباشد `null` می‌دهد", () => {
    assert.equal(extractUrl(Buffer.from("در حال ساخت…")), null);
  });
});

describe("browserOpenCommand", () => {
  it("برای هر سیستم‌عامل فرمان درست را می‌دهد", () => {
    const { command, args } = browserOpenCommand("http://localhost:3000");

    if (process.platform === "win32") {
      // روی ویندوز `start` باید از طریق cmd اجرا شود، وگرنه به‌عنوان عنوان پنجره گرفته می‌شود.
      assert.equal(command, "cmd");
      assert.deepEqual(args.slice(0, 3), ["/c", "start", ""]);
    } else if (process.platform === "darwin") {
      assert.equal(command, "open");
    } else {
      assert.equal(command, "xdg-open");
    }

    assert.equal(args.at(-1), "http://localhost:3000");
  });
});

/** نوشتن یک فایل موقت و برگرداندن مسیر آن. */
function writeTempEnv(name: string, content: string): string {
  const filePath = path.join(temporaryDirectory, name);

  fs.writeFileSync(filePath, content, "utf8");

  return filePath;
}
