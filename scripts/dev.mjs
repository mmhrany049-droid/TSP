#!/usr/bin/env node
/**
 * اجرای سرور توسعهٔ TSP + باز کردن خودکار مرورگر.
 *
 *   npm run dev        → اجرای ساده (بدون باز کردن مرورگر)
 *   npm run dev:open   → اجرا + باز شدن خودکار http://localhost:3000
 *
 * چرا اسکریپت جداگانه؟
 *   دستورهای ویندوز (`start`)، مک (`open`) و لینوکس (`xdg-open`) با هم فرق دارند و
 *   اگر با `start` خالی داخل اسکریپت npm نوشته شوند، پوستهٔ ویندوز آن را با
 *   عنوان پنجره اشتباه می‌گیرد. این اسکریپت همان کار را بدون وابستگی بیرونی و
 *   به‌صورت امن انجام می‌دهد، و اگر مرورگر باز نشد فقط یک راهنما چاپ می‌کند.
 *
 * نکته: پورت اشغال باشد، Next خودش پورت بعدی را انتخاب می‌کند؛ این اسکریپت آدرس
 * واقعی را از خروجی Next می‌خواند و همان را در مرورگر باز می‌کند.
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = process.cwd();
const DEFAULT_URL = "http://localhost:3000";
const NEXT_BIN = path.join(PROJECT_ROOT, "node_modules", "next", "dist", "bin", "next");

const args = process.argv.slice(2);
const shouldOpenBrowser = args.includes("--open");
const nextArgs = args.filter((arg) => arg !== "--open");

/** دستور باز کردن آدرس پیش‌فرض، سازگار با ویندوز/مک/لینوکس. */
export function browserOpenCommand(url) {
  if (process.platform === "win32") {
    return { command: "cmd", args: ["/c", "start", "", url] };
  }

  return { command: process.platform === "darwin" ? "open" : "xdg-open", args: [url] };
}

/**
 * باز کردن آدرس در مرورگر پیش‌فرض.
 *
 * @returns {Promise<boolean>} آیا فرمان باز کردن مرورگر واقعاً اجرا شد؟
 *
 * نکتهٔ مهم: اگر فرمان باز کردن مرورگر روی سیستم نصب نباشد (مثلاً `xdg-open` در
 * لینوکس‌های سبک)، آن خطا یک رویداد `error` روی پروسهٔ فرزند است؛ اگر مدیریت نشود،
 * Node آن را «unhandled error event» می‌بیند و **کل سرور توسعه را می‌بندد**. پس اینجا
 * خطا گرفته می‌شود و فقط پیام «مرورگر را دستی باز کنید» نمایش داده می‌شود.
 */
export function openInBrowser(url) {
  return new Promise((resolve) => {
    let child;

    try {
      const { command, args } = browserOpenCommand(url);

      child = spawn(command, args, { detached: true, stdio: "ignore" });
    } catch {
      resolve(false);
      return;
    }

    child.once("error", () => resolve(false));
    child.once("spawn", () => resolve(true));
    child.unref();
  });
}

/** استخراج آدرس سرور از خروجی Next.js. */
export function extractUrl(chunk) {
  const text = chunk.toString();

  // الگوی «- Local: http://localhost:3000»
  const match = text.match(/https?:\/\/(?:localhost|127\.0\.0\.1|\[[^\]]+\])[:0-9]*/i);

  return match ? match[0] : null;
}

function printBanner() {
  console.log(
    [
      "",
      "  ╭──────────────────────────────────────────────╮",
      "  │  TSP — سامانه مدیریت تست، مطالعه و آمادگی      │",
      "  ╰──────────────────────────────────────────────╯",
      "",
      "  • برای بستن سرور، کلیدهای Ctrl + C را بزنید.",
      `  • اگر مرورگر باز نشد، آدرس چاپ‌شده در همین خروجی را باز کنید (پیش‌فرض: ${DEFAULT_URL}).`,
      "  • نخستین بار؟ در صفحهٔ «ثبت‌نام» حساب خودتان را بسازید.",
      "",
    ].join(os.EOL),
  );
}

function main() {
  printBanner();

  if (!fs.existsSync(NEXT_BIN)) {
    console.error(
      [
        "✖ بستهٔ Next.js نصب نشده است.",
        "  راه‌حل: در همین پوشه `npm install` را اجرا کنید و بعد دوباره `npm run dev:open`.",
        "",
      ].join("\n"),
    );
    process.exit(1);
  }

  const child = spawn(process.execPath, [NEXT_BIN, "dev", "--turbopack", ...nextArgs], {
    cwd: PROJECT_ROOT,
    stdio: ["inherit", "pipe", "pipe"],
  });

  let browserOpened = false;

  /** خواندن خروجی Next، نمایش آن و باز کردن مرورگر در نخستین فرصت. */
  function handleOutput(chunk, target) {
    target.write(chunk);

    if (!browserOpened && shouldOpenBrowser) {
      const url = extractUrl(chunk);

      if (url) {
        browserOpened = true;
        // کمی صبر می‌کنیم تا سرور آمادهٔ پاسخ شود.
        setTimeout(() => {
          openInBrowser(url)
            .then((opened) => {
              console.log(
                opened
                  ? `\n  ✔ مرورگر باز شد: ${url}\n`
                  : `\n  ⚠ مرورگر خودکار باز نشد؛ این آدرس را دستی باز کنید: ${url}\n`,
              );
            })
            .catch(() => {
              console.log(`\n  ⚠ مرورگر خودکار باز نشد؛ این آدرس را دستی باز کنید: ${url}\n`);
            });
        }, 1200);
      }
    }
  }

  child.stdout.on("data", (chunk) => handleOutput(chunk, process.stdout));
  child.stderr.on("data", (chunk) => handleOutput(chunk, process.stderr));

  // اگر Next هرگز آدرس را چاپ نکرد (مثلاً خطای خیلی زود)، خودمان مرورگر را باز می‌کنیم.
  if (shouldOpenBrowser) {
    setTimeout(() => {
      if (browserOpened) {
        return;
      }

      browserOpened = true;
      openInBrowser(DEFAULT_URL).catch(() => {});
    }, 15000);
  }

  // Ctrl+C در والد و فرزند یکسان رفتار کند.
  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.on(signal, () => {
      child.kill(signal);
    });
  }

  child.on("exit", (code) => {
    process.exit(code ?? 0);
  });

  child.on("error", (error) => {
    console.error(`✖ اجرای سرور ممکن نشد: ${error.message}`);
    console.error("  راه‌حل: `npm install` را اجرا کنید و دوباره تلاش کنید.");
    process.exit(1);
  });
}

/*
 * سرور فقط وقتی اجرا می‌شود که همین فایل مستقیم اجرا شده باشد
 * (`node scripts/dev.mjs`)، نه وقتی آزمون‌ها آن را `import` می‌کنند.
 */
const isDirectRun =
  process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  main();
}
