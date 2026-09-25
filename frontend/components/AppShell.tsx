"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BookOpen, History, LayoutDashboard, LogOut, Menu, X } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { cx } from "@/components/ui";

const NAV = [
  { href: "/", label: "داشبورد", icon: LayoutDashboard },
  { href: "/books", label: "کتاب‌ها", icon: BookOpen },
  { href: "/attempts", label: "تاریخچه تلاش‌ها", icon: History },
];

function Logo({ light = false }: { light?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span className={cx("grid h-10 w-10 place-items-center rounded-xl", light ? "bg-white/10" : "bg-pine text-white")}>
        <span className="text-sm font-black tracking-tight">TSP</span>
      </span>
      <span>
        <span className={cx("block text-sm font-extrabold", light ? "text-white" : "text-ink")}>سامانه تست</span>
        <span className={cx("block text-xs", light ? "text-white/60" : "text-muted")}>ریاضی-فیزیک</span>
      </span>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  function isActive(href: string): boolean {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[17.5rem_1fr]">
      <aside
        className={cx(
          "fixed inset-y-0 right-0 z-40 flex w-72 flex-col bg-night px-4 py-5 text-white transition lg:static lg:w-auto lg:translate-x-0",
          open ? "translate-x-0" : "translate-x-full lg:translate-x-0",
        )}
      >
        <div className="flex items-center justify-between">
          <Logo light />
          <button className="rounded-lg p-2 lg:hidden" type="button" onClick={() => setOpen(false)} aria-label="بستن منو">
            <X size={18} />
          </button>
        </div>
        <nav className="mt-8 space-y-1">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cx(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                  active ? "bg-white/15 text-white" : "text-white/70 hover:bg-white/10 hover:text-white",
                )}
              >
                <Icon size={18} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto rounded-2xl bg-white/10 p-3">
          <p className="truncate text-sm font-bold">{user?.name || "دانش‌آموز"}</p>
          <p className="truncate text-xs text-white/55" dir="ltr">
            {user?.email}
          </p>
          <button
            type="button"
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-sm hover:bg-white/15"
            onClick={() => {
              logout();
              router.replace("/login");
            }}
          >
            <LogOut size={16} />
            خروج
          </button>
        </div>
      </aside>
      {open ? <button className="fixed inset-0 z-30 bg-black/40 lg:hidden" type="button" onClick={() => setOpen(false)} aria-label="بستن" /> : null}
      <div className="min-w-0">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-line/80 bg-paper/90 px-4 py-3 backdrop-blur lg:hidden">
          <Logo />
          <button type="button" className="rounded-xl border border-line bg-white p-2" onClick={() => setOpen(true)} aria-label="منو">
            <Menu size={18} />
          </button>
        </header>
        <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>
      </div>
    </div>
  );
}
