import type { Metadata } from "next";
import Link from "next/link";

import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "ثبت‌نام" };

/** صفحهٔ ثبت‌نام؛ در پرامپت ۲ همراه NextAuth پیاده‌سازی می‌شود. */
export default function RegisterPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>ساخت حساب کاربری</CardTitle>
      </CardHeader>
      <CardBody className="space-y-4 text-sm text-slate-600">
        <p>
          فرم ثبت‌نام (نام، ایمیل و گذرواژه) در مرحلهٔ بعد اضافه می‌شود؛ گذرواژه همیشه به‌صورت
          هش‌شده در مدل <span className="numeric">User.passwordHash</span> ذخیره خواهد شد.
        </p>
        <p className="text-slate-500">
          حساب دارید؟{" "}
          <Link href="/login" className="font-medium text-slate-900 underline">
            وارد شوید
          </Link>
        </p>
      </CardBody>
    </Card>
  );
}
