"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { GraduationCap } from "lucide-react";

import { APP_TITLE } from "@/lib/constants";
import { cn } from "@/lib/utils";

import { NAV_GROUPS } from "./nav-items";

/** منوی کناری راست‌چین با نشان‌دادن صفحهٔ فعال. */
export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-72 shrink-0 border-s border-slate-200 bg-white lg:block">
      <div className="flex h-16 items-center gap-3 border-b border-slate-200 px-5">
        <span className="flex size-10 items-center justify-center rounded-xl bg-slate-900 text-sm font-bold text-white">
          TSP
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900">مدیریت تست</p>
          <p className="truncate text-xs text-slate-500">{APP_TITLE}</p>
        </div>
      </div>

      <nav className="space-y-6 p-4" aria-label="منوی اصلی">
        {NAV_GROUPS.map((group) => (
          <div key={group.title}>
            <p className="px-3 pb-2 text-xs font-medium text-slate-400">{group.title}</p>
            <ul className="space-y-1">
              {group.items.map((item) => {
                const isActive = pathname === item.href;
                const Icon = item.icon;

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={isActive ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
                        isActive
                          ? "bg-slate-900 text-white"
                          : "text-slate-700 hover:bg-slate-100 hover:text-slate-900",
                      )}
                    >
                      <Icon className="size-4 shrink-0" aria-hidden />
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{item.label}</span>
                        <span
                          className={cn(
                            "block truncate text-xs",
                            isActive ? "text-slate-300" : "text-slate-400",
                          )}
                        >
                          {item.description}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="mx-4 mb-5 flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500">
        <GraduationCap className="size-4" aria-hidden />
        <span>رشتهٔ ریاضی-فیزیک</span>
      </div>
    </aside>
  );
}
