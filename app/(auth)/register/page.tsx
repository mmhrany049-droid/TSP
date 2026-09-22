import type { Metadata } from "next";

import { RegisterForm } from "@/components/auth/register-form";

export const metadata: Metadata = {
  title: "ثبت‌نام",
  description: "ساخت حساب کاربری تازه در TSP",
};

/**
 * صفحهٔ ثبت‌نام.
 *
 * اولین حسابی که ساخته می‌شود، صاحب همان پایگاه دادهٔ محلی است؛ برای شروع کار
 * کافی است یک بار ثبت‌نام کنید و از آن پس با همان ایمیل وارد شوید.
 */
export default function RegisterPage() {
  return <RegisterForm />;
}
