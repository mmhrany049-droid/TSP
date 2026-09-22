"use client";

import { useEffect } from "react";

/**
 * مرز خطای ریشه.
 *
 * اگر خطا در خودِ چیدمان ریشه (app/layout.tsx) رخ دهد، `app/error.tsx` کافی نیست و
 * همین فایل جای کل صفحه را می‌گیرد. چون اینجا چیدمان ریشه در دسترس نیست، استایل‌ها
 * به‌صورت درون‌خطی نوشته شده‌اند تا صفحه حتی بدون CSS هم خوانا بماند.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[خطای ریشهٔ برنامه]", error);
  }, [error]);

  return (
    <html lang="fa" dir="rtl">
      <body
        style={{
          minHeight: "100vh",
          margin: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#f8fafc",
          color: "#0f172a",
          fontFamily: "Tahoma, system-ui, sans-serif",
          padding: "20px",
        }}
      >
        <div
          style={{
            maxWidth: "560px",
            width: "100%",
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: "16px",
            padding: "20px",
          }}
        >
          <h1 style={{ fontSize: "18px", margin: "0 0 12px" }}>خطایی در اجرای برنامه رخ داد</h1>

          <p style={{ fontSize: "14px", lineHeight: 1.9, margin: "0 0 12px" }}>
            لطفاً این موارد را بررسی کنید:
          </p>

          <ul style={{ fontSize: "14px", lineHeight: 2, paddingInlineStart: "20px", margin: "0 0 16px" }}>
            <li>
              فایل <code dir="ltr">.env</code> وجود دارد؟ (ساخت آن: <code dir="ltr">npm run init:env</code>)
            </li>
            <li>
              پایگاه داده ساخته شده؟ (<code dir="ltr">npm run db:setup</code>)
            </li>
            <li>
              گزارش عیب‌یابی: <code dir="ltr">npm run doctor</code>
            </li>
          </ul>

          <pre
            dir="ltr"
            style={{
              background: "#0f172a",
              color: "#e2e8f0",
              padding: "12px",
              borderRadius: "12px",
              fontSize: "12px",
              overflowX: "auto",
              direction: "ltr",
            }}
          >
            {error?.message || "خطای نامشخص"}
            {error?.digest ? `\n(digest: ${error.digest})` : ""}
          </pre>

          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: "16px",
              background: "#0f172a",
              color: "#ffffff",
              border: "none",
              borderRadius: "12px",
              padding: "10px 16px",
              fontSize: "14px",
              cursor: "pointer",
            }}
          >
            تلاش دوباره
          </button>
        </div>
      </body>
    </html>
  );
}
