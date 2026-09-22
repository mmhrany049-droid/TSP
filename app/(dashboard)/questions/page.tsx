import type { Metadata } from "next";

import { PlaceholderPage } from "@/components/placeholder-page";

export const metadata: Metadata = { title: "بانک تست" };

/** این صفحه در پرامپت مربوط به همین ماژول کامل می‌شود. */
export default function QuestionsPage() {
  return (
    <PlaceholderPage
      title="بانک تست"
      description="ثبت و جست‌وجوی تست‌ها؛ هر تست شمارهٔ نمایشی، پاسخ صحیح و محل دقیق در کتاب دارد."
      features={[
    "افزودن تست به یک بخش مشخص از کتاب",
    "علامت‌گذاری مهم و سخت به‌صورت مستقل از سختی ناشر",
    "فیلتر بر پایهٔ کتاب، بخش، مبحث و وضعیت حل‌شدن",
      ]}
    />
  );
}
