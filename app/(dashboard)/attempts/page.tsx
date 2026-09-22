import type { Metadata } from "next";

import { PlaceholderPage } from "@/components/placeholder-page";

export const metadata: Metadata = { title: "ثبت و سابقهٔ حل" };

/** این صفحه در پرامپت مربوط به همین ماژول کامل می‌شود. */
export default function AttemptsPage() {
  return (
    <PlaceholderPage
      title="ثبت و سابقهٔ حل"
      description="ثبت هر بار حل تست و ورود تست‌هایی که پیش از استفاده از برنامه حل شده‌اند."
      features={[
    "ثبت تلاش جدید با پاسخ، نتیجه و زمان صرف‌شدهٔ اختیاری",
    "ورود گروهی حل‌های قبلی بدون نیاز به تاریخ دقیق",
    "نمایش تاریخچهٔ کامل؛ هیچ رکورد قبلی بازنویسی نمی‌شود",
      ]}
    />
  );
}
