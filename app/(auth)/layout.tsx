import type { ReactNode } from "react";

import { APP_TITLE } from "@/lib/constants";

/** چیدمان صفحه‌های ورود و ثبت‌نام: بدون منوی کناری، کارت وسط‌چین. */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-5">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-slate-900 text-base font-bold text-white">
            TSP
          </span>
          <h1 className="mt-4 text-lg font-semibold text-slate-900">{APP_TITLE}</h1>
        </div>
        {children}
      </div>
    </div>
  );
}
