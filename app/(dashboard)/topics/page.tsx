import type { Metadata } from "next";

import { PlaceholderPage } from "@/components/placeholder-page";

export const metadata: Metadata = { title: "مباحث آموزشی" };

/** این صفحه در پرامپت مربوط به همین ماژول کامل می‌شود. */
export default function TopicsPage() {
  return (
    <PlaceholderPage
      title="مباحث آموزشی"
      description="درخت مباحث، مستقل از ساختار کتاب؛ یک تست می‌تواند به چند مبحث وصل باشد."
      features={[
    "ساخت و ویرایش درخت مباحث",
    "اتصال تست‌ها به مبحث اصلی، فرعی یا مخلوط",
    "نمایش وضعیت هر مبحث (فعال یا بایگانی‌شده)",
      ]}
    />
  );
}
