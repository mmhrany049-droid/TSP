import type { Metadata } from "next";

import { PlaceholderPage } from "@/components/placeholder-page";

export const metadata: Metadata = { title: "مرور هوشمند" };

/** این صفحه در پرامپت مربوط به همین ماژول کامل می‌شود. */
export default function ReviewPage() {
  return (
    <PlaceholderPage
      title="مرور هوشمند"
      description="فهرست کارهای مرور بر پایهٔ غلط‌ها، نزده‌ها، مهم‌ها، سخت‌ها و مباحث عقب‌مانده."
      features={[
    "فیلتر ترکیبی غلط / نزده / مهم / سخت",
    "اولویت‌بندی موارد مرور",
    "ثبت پاسخ هنگام مرور و بستن مورد مرور",
      ]}
    />
  );
}
