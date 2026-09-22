import Link from "next/link";

import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";

/** صفحهٔ ۴۰۴ فارسی؛ به‌جای صفحهٔ پیش‌فرض انگلیسی Next.js. */
export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-lg items-center p-5">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>صفحه پیدا نشد</CardTitle>
        </CardHeader>
        <CardBody className="space-y-3 text-sm text-slate-600">
          <p>نشانی‌ای که باز کرده‌اید وجود ندارد یا جابه‌جا شده است.</p>
          <p>
            <Link href="/" className="font-medium text-slate-900 underline underline-offset-4">
              بازگشت به داشبورد
            </Link>
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
