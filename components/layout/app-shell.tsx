import type { ReactNode } from "react";

import { APP_NAME } from "@/lib/constants";

import { Sidebar } from "./sidebar";

/**
 * پوستهٔ اصلی برنامهٔ داخلی: منوی کناری (سمت راست، چون RTL است) + نوار بالایی.
 *
 * تا زمانی که احراز هویت پیاده نشده، نوار بالایی فقط نام برنامه را نشان می‌دهد؛
 * در مرحلهٔ بعد (پرامپت ۲) نام کاربر و دکمهٔ خروج به همین نوار اضافه می‌شود.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-row bg-slate-50">
      <Sidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-5">
          <div className="flex items-center gap-3 lg:hidden">
            <span className="flex size-9 items-center justify-center rounded-lg bg-slate-900 text-xs font-bold text-white">
              TSP
            </span>
          </div>
          <p className="text-sm text-slate-500">
            نسخهٔ <span className="font-medium text-slate-700">{APP_NAME} ۰.۲</span> — مرحلهٔ ساخت
            زیرساخت
          </p>
          <div className="text-sm text-slate-400">حالت مهمان</div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 p-5 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
