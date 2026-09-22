"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

import { NAV_GROUPS } from "./nav-items";

/** منوی افقی برای نمایشگرهای کوچک (منوی کناری در آن اندازه‌ها پنهان است). */
export function MobileNav() {
  const pathname = usePathname();
  const items = NAV_GROUPS.flatMap((group) => group.items);

  return (
    <nav aria-label="منوی اصلی (موبایل)" className="border-b border-slate-200 bg-white px-2 lg:hidden">
      <ul className="flex gap-1 overflow-x-auto py-2">
        {items.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium whitespace-nowrap transition-colors",
                  isActive
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                )}
              >
                <Icon className="size-3.5" aria-hidden />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
