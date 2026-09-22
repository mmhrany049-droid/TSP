import type { Metadata } from "next";

import { PlaceholderPage } from "@/components/placeholder-page";

export const metadata: Metadata = { title: "آزمون‌ها" };

/** این صفحه در پرامپت مربوط به همین ماژول کامل می‌شود. */
export default function ExamsPage() {
  return (
    <PlaceholderPage
      title="آزمون‌ها"
      description="تعریف آزمون، انتخاب سؤال‌ها و ثبت کارنامهٔ هر اجرا."
      features={[
    "تعریف آزمون تک‌درس، چنددرس، آزمایشی یا چکاپ",
    "افزودن سؤال از بانک تست یا به‌صورت دستی",
    "ثبت اجرای مستقل آزمون و محاسبهٔ درصد و کارنامه",
      ]}
    />
  );
}
