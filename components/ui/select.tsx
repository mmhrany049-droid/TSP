import type { SelectHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

/** انتخابگر کشویی هم‌ظاهر با بقیهٔ ورودی‌های برنامه. */
export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900",
        "focus:border-slate-500 focus:ring-2 focus:ring-slate-200 focus:outline-none",
        "disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400",
        "aria-[invalid=true]:border-rose-400",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}
