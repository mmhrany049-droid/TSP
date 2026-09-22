import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** حالت خالی: وقتی هنوز داده‌ای ثبت نشده یا فیلتر نتیجه‌ای نداده است. */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 px-6 py-10 text-center",
        className,
      )}
    >
      {icon ? <span className="text-slate-400">{icon}</span> : null}
      <p className="text-sm font-medium text-slate-700">{title}</p>
      {description ? <p className="max-w-md text-xs text-slate-500">{description}</p> : null}
      {action}
    </div>
  );
}
