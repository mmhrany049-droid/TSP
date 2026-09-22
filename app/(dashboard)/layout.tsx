import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { auth } from "@/lib/auth";
import { LOGIN_PATH } from "@/lib/auth.config";

/**
 * چیدمان صفحه‌های داخلی برنامه (بعد از ورود کاربر).
 *
 * میدل‌ور هم مسیرها را محافظت می‌کند، اما این بررسی دوباره انجام می‌شود تا اگر
 * روزی میدل‌ور جایی غیرفعال شود، داده‌های کاربر به‌اشتباه نمایش داده نشود.
 */
export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await auth();

  if (!session?.user) {
    redirect(LOGIN_PATH);
  }

  const name = session.user.name?.trim() || "دانش‌آموز";
  const email = session.user.email ?? "";

  return <AppShell user={{ name, email }}>{children}</AppShell>;
}
