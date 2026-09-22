import fs from "node:fs";
import path from "node:path";

import type { Metadata, Viewport } from "next";

import { APP_TITLE } from "@/lib/constants";

import "./globals.css";

/**
 * قلم فارسی «وزیرمتن» به‌صورت محلی سرو می‌شود (بدون درخواست از اینترنت).
 *
 * قلم‌ها در `public/fonts` هستند و با `@font-face` در `app/globals.css` معرفی
 * شده‌اند. چون `next/font/local` هنگام «ساخت» فایل را به‌عنوان ماژول می‌خواند و در
 * نبود آن، کل ساخت شکست می‌خورد، اینجا از @font-face استفاده می‌شود: نبود فایل قلم
 * فقط به‌معنی استفاده از قلم پیش‌فرض سیستم است و هیچ‌وقت برنامه را از کار نمی‌اندازد.
 */
const FONT_FILES = [
  "vazirmatn-arabic-wght-normal.woff2",
  "vazirmatn-latin-wght-normal.woff2",
] as const;

const fontsDirectory = path.join(process.cwd(), "public", "fonts");
const availableFonts = FONT_FILES.filter((file) => fs.existsSync(path.join(fontsDirectory, file)));

export const metadata: Metadata = {
  title: {
    default: `TSP — ${APP_TITLE}`,
    template: "%s | TSP",
  },
  description:
    "سامانهٔ مدیریت تست، مطالعه و آمادگی آزمون برای دانش‌آموز رشتهٔ ریاضی-فیزیک: کتاب و ساختار، بانک تست، ثبت تلاش، مرور هوشمند، تدریس و آزمون.",
  applicationName: "TSP",
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fa" dir="rtl">
      <head>
        {/* پیش‌بارگذاری قلم‌ها فقط اگر فایلشان موجود باشد (تا هشدار مرورگر نگیریم). */}
        {availableFonts.map((file) => (
          <link
            key={file}
            rel="preload"
            href={`/fonts/${file}`}
            as="font"
            type="font/woff2"
            crossOrigin="anonymous"
          />
        ))}
      </head>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
