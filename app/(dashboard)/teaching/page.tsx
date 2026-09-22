import type { Metadata } from "next";

import { PlaceholderPage } from "@/components/placeholder-page";

export const metadata: Metadata = { title: "تدریس و عقب‌ماندگی" };

/** این صفحه در پرامپت مربوط به همین ماژول کامل می‌شود. */
export default function TeachingPage() {
  return (
    <PlaceholderPage
      title="تدریس و عقب‌ماندگی"
      description="وضعیت تدریس هر مبحث و مقایسهٔ آن با هدف تعداد تست."
      features={[
    "ثبت وضعیت تدریس (تدریس‌نشده، تدریس‌شده، مرورشده)",
    "تعریف هدف تعداد تست برای هر مبحث",
    "نمایش عقب‌ماندگی بر پایهٔ هدف‌ها و تلاش‌های ثبت‌شده",
      ]}
    />
  );
}
