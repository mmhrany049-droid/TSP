import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";

import { APP_TITLE } from "@/lib/constants";

import "./globals.css";

/**
 * قلم فارسی «وزیرمتن» به‌صورت محلی سرو می‌شود (بدون درخواست از اینترنت).
 * فایل‌ها در `app/fonts` قرار دارند و پروانهٔ آن‌ها هم کنارشان است.
 */
const vazirmatn = localFont({
  src: [
    { path: "./fonts/vazirmatn-arabic-wght-normal.woff2", weight: "100 900", style: "normal" },
    { path: "./fonts/vazirmatn-latin-wght-normal.woff2", weight: "100 900", style: "normal" },
  ],
  variable: "--font-vazirmatn",
  display: "swap",
  preload: true,
});

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
    <html lang="fa" dir="rtl" className={vazirmatn.variable}>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
