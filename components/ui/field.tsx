import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * یک فیلد فرم: برچسب + ورودی + پیام راهنما یا خطا.
 *
 * خطای فیلد با `role="alert"` اعلام می‌شود تا صفحه‌خوان‌ها هم آن را بخوانند.
 */
export function Field({
  id,
  label,
  error,
  hint,
  required,
  className,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={id} className="block text-sm font-medium text-slate-700">
        {label}
        {required ? <span className="text-rose-500"> *</span> : null}
      </label>

      {children}

      {error ? (
        <p id={`${id}-error`} role="alert" className="text-xs text-rose-600">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-slate-400">{hint}</p>
      ) : null}
    </div>
  );
}

/** نوار خطای کلی فرم (خطاهای غیرفیلدی مثل نادرست بودن گذرواژه). */
export function FormAlert({ tone = "error", children }: { tone?: "error" | "info"; children: ReactNode }) {
  return (
    <div
      role="alert"
      className={cn(
        "rounded-xl border px-3 py-2.5 text-sm",
        tone === "error"
          ? "border-rose-200 bg-rose-50 text-rose-700"
          : "border-sky-200 bg-sky-50 text-sky-700",
      )}
    >
      {children}
    </div>
  );
}
