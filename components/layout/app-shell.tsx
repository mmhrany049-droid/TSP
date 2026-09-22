import type { ReactNode } from "react";

import { Header } from "./header";
import { MobileNav } from "./mobile-nav";
import { Sidebar } from "./sidebar";

/** کاربر واردشده، همان‌قدر که پوستهٔ برنامه لازم دارد. */
export interface ShellUser {
  name: string;
  email: string;
}

/**
 * پوستهٔ اصلی برنامهٔ داخلی: منوی کناری (سمت راست، چون RTL است) + نوار بالایی.
 *
 * کاربر از چیدمان `app/(dashboard)/layout.tsx` می‌آید که پیش از رندر، نشست را
 * بررسی می‌کند.
 */
export function AppShell({ user, children }: { user: ShellUser; children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-row bg-slate-50">
      <Sidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        <Header user={user} />
        <MobileNav />

        <main className="mx-auto w-full max-w-6xl flex-1 p-4 lg:p-8">{children}</main>

        <footer className="px-4 pb-5 text-center text-xs text-slate-400 lg:px-8">
          سامانه مدیریت تست، مطالعه و آمادگی آزمون — نسخهٔ ۰.۲
        </footer>
      </div>
    </div>
  );
}
