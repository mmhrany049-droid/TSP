import type { InputHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

/**
 * ورودی متن برنامه.
 *
 * در حالت راست‌به‌چپ، برای فیلدهایی مثل ایمیل که محتوایشان لاتین است، کافی است
 * `dir="ltr"` را پاس بدهید تا مکان‌نما و متن درست نشان داده شوند.
 */
export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900",
        "placeholder:text-slate-400",
        "focus:border-slate-500 focus:ring-2 focus:ring-slate-200 focus:outline-none",
        "disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400",
        "aria-[invalid=true]:border-rose-400 aria-[invalid=true]:focus:ring-rose-100",
        className,
      )}
      {...props}
    />
  );
}
