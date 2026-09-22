import type { Metadata } from "next";

import { PlaceholderPage } from "@/components/placeholder-page";

export const metadata: Metadata = { title: "کتاب‌ها و ساختار" };

/** این صفحه در پرامپت مربوط به همین ماژول کامل می‌شود. */
export default function BooksPage() {
  return (
    <PlaceholderPage
      title="کتاب‌ها و ساختار"
      description="مدیریت کتاب‌های تست و ساختار درختی آن‌ها (فصل، بخش، تست‌های مخلوط، آزمون چکاپ و جامع)."
      features={[
    "تعریف کتاب با عنوان، درس، ناشر و پایه",
    "ساخت گره‌های ساختار کتاب به‌صورت درختی",
    "نمای کلی هر کتاب همراه با تعداد تست‌های هر بخش",
      ]}
    />
  );
}
