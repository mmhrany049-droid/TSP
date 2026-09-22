import type { TextareaHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

/** ناحیهٔ متن برنامه (برای یادداشت‌ها و توضیح‌های چندخطی). */
export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900",
        "placeholder:text-slate-400",
        "focus:border-slate-500 focus:ring-2 focus:ring-slate-200 focus:outline-none",
        "disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400",
        "aria-[invalid=true]:border-rose-400",
        className,
      )}
      rows={3}
      {...props}
    />
  );
}
