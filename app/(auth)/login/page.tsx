import type { Metadata } from "next";
import Link from "next/link";

import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "ورود" };

/** صفحهٔ ورود؛ در پرامپت ۲ همراه NextAuth پیاده‌سازی می‌شود. */
export default function LoginPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>ورود به حساب</CardTitle>
      </CardHeader>
      <CardBody className="space-y-4 text-sm text-slate-600">
        <p>
          فرم ورود در مرحلهٔ بعد (احراز هویت با NextAuth) به همین صفحه اضافه می‌شود. تا آن زمان
          برنامه در حالت مهمان کار می‌کند.
        </p>
        <p className="text-slate-500">
          حساب کاربری ندارید؟{" "}
          <Link href="/register" className="font-medium text-slate-900 underline">
            ثبت‌نام کنید
          </Link>
        </p>
        <p>
          <Link href="/" className="font-medium text-slate-900 underline">
            بازگشت به داشبورد
          </Link>
        </p>
      </CardBody>
    </Card>
  );
}
