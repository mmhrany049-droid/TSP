import type { ReactNode } from "react";

import { AppShell } from "@/components/layout/app-shell";

/** چیدمان صفحه‌های داخلی برنامه (بعد از ورود کاربر). */
export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
