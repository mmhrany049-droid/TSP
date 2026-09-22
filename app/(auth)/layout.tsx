import type { ReactNode } from "react";

import { APP_TITLE, APP_VERSION } from "@/lib/constants";

/** چیدمان صفحه‌های ورود و ثبت‌نام: بدون منوی کناری، کارت وسط‌چین. */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-slate-100 to-slate-50 p-5">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-slate-900 text-base font-bold text-white">
            TSP
          </span>
          <h1 className="mt-4 text-lg font-semibold text-slate-900">{APP_TITLE}</h1>
          <p className="mt-1 text-xs text-slate-500">رشتهٔ ریاضی-فیزیک — آمادگی آزمون</p>
        </div>

        {children}

        <p className="text-center text-xs text-slate-400">
          نسخهٔ <span className="numeric">{APP_VERSION}</span> — اطلاعات شما فقط روی پایگاه دادهٔ
          خودتان ذخیره می‌شود.
        </p>
      </div>
    </div>
  );
}
