"use client";

import { useEffect } from "react";
import { AlertOctagon, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { CommandLine, Notice, NoticeList } from "@/components/ui/notice";

/**
 * صفحهٔ خطای برنامه.
 *
 * Next.js هر خطای پیش‌بینی‌نشده در سمت سرور را به این «مرز خطا» می‌فرستد. هدف این
 * صفحه دو چیز است: (۱) کاربر هرگز صفحهٔ سفید نبیند، (۲) پیام فنی به راهنمای فارسی
 * و قابل‌فهم تبدیل شود.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[خطای برنامه]", error);
  }, [error]);

  const rawMessage = error?.message ?? "";
  const isMissingSecret = /AUTH_SECRET|MissingSecret|secret/i.test(rawMessage);
  const isDatabase = /prisma|database|sqlite|P1003|P2021|no such table/i.test(rawMessage);

  const title = isMissingSecret
    ? "کلید امنیتی نشست (AUTH_SECRET) تنظیم نشده است"
    : isDatabase
      ? "اتصال به پایگاه داده برقرار نشد"
      : "خطایی رخ داد";

  const hints = isMissingSecret
    ? [
        "در ریشهٔ پروژه فایل .env بسازید و خط زیر را به آن اضافه کنید:",
        'AUTH_SECRET="یک-رشتهٔ-تصادفی-بلند"',
        "برای ساخت مقدار تصادفی: npm run init:env -- --force",
      ]
    : isDatabase
      ? [
          "دستور `npm run db:setup` را اجرا کنید تا فایل و جدول‌های پایگاه داده ساخته شوند.",
          "اگر مشکل ادامه داشت، `npm run doctor` را اجرا کنید.",
        ]
      : ["صفحه را دوباره بارگذاری کنید.", "اگر خطا تکرار شد، `npm run doctor` را اجرا کنید."];

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-2xl items-center p-5">
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertOctagon className="size-5 text-rose-600" aria-hidden />
            {title}
          </CardTitle>
        </CardHeader>

        <CardBody className="space-y-4 text-sm text-slate-600">
          <Notice tone="error" title="چه کاری انجام دهم؟">
            <NoticeList items={hints} />
            <p className="flex flex-wrap items-center gap-2 text-xs">
              راهنمای کامل:
              <CommandLine>npm run doctor</CommandLine>
            </p>
          </Notice>

          <p className="text-xs text-slate-500">
            اگر می‌خواهید جزئیات فنی را ببینید، آن را برای پشتیبانی بفرستید:
          </p>
          <pre
            dir="ltr"
            className="max-h-40 overflow-auto rounded-xl bg-slate-900 p-3 text-xs text-slate-100"
          >
            {rawMessage || "خطای نامشخص"}
            {error?.digest ? `\n(digest: ${error.digest})` : ""}
          </pre>

          <div className="flex flex-wrap gap-3">
            <Button onClick={reset} variant="primary">
              <RotateCcw className="size-4" aria-hidden />
              تلاش دوباره
            </Button>
            <Button variant="outline" onClick={() => window.location.assign("/login")}>
              رفتن به صفحهٔ ورود
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
