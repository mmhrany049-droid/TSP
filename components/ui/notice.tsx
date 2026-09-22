import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * کادر پیام برنامه (راهنما، هشدار، خطا).
 *
 * برای پیام‌های محیطی و راهنمای اجرا استفاده می‌شود؛ برخلاف `FormAlert` که مخصوص
 * خطاهای فرم است، این کادر عنوان، فهرست راهنما و فهرست دستورها را هم پشتیبانی می‌کند.
 */
type NoticeTone = "info" | "success" | "warning" | "error";

const TONES: Record<NoticeTone, { wrapper: string; icon: ReactNode; title: string }> = {
  info: {
    wrapper: "border-sky-200 bg-sky-50 text-sky-900",
    icon: <Info className="size-5" aria-hidden />,
    title: "text-sky-900",
  },
  success: {
    wrapper: "border-emerald-200 bg-emerald-50 text-emerald-900",
    icon: <CheckCircle2 className="size-5" aria-hidden />,
    title: "text-emerald-900",
  },
  warning: {
    wrapper: "border-amber-200 bg-amber-50 text-amber-900",
    icon: <AlertTriangle className="size-5" aria-hidden />,
    title: "text-amber-900",
  },
  error: {
    wrapper: "border-rose-200 bg-rose-50 text-rose-900",
    icon: <XCircle className="size-5" aria-hidden />,
    title: "text-rose-900",
  },
};

export function Notice({
  tone = "info",
  title,
  children,
  className,
}: {
  tone?: NoticeTone;
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  const style = TONES[tone];

  return (
    <section
      // هشدار و خطا باید توسط صفحه‌خوان‌ها اعلام شوند.
      role={tone === "error" || tone === "warning" ? "alert" : undefined}
      className={cn("rounded-2xl border p-4 text-sm shadow-sm", style.wrapper, className)}
    >
      <div className="flex gap-3">
        <span className="mt-0.5 shrink-0">{style.icon}</span>
        <div className="min-w-0 flex-1 space-y-2">
          {title ? <p className={cn("font-semibold", style.title)}>{title}</p> : null}
          {children}
        </div>
      </div>
    </section>
  );
}

/** فهرست گلوله‌ای برای پیام‌های راهنما. */
export function NoticeList({ items }: { items: readonly string[] }) {
  if (items.length === 0) {
    return null;
  }

  return (
    <ul className="list-inside list-disc space-y-1">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

/** نمایش یک دستور ترمینال؛ با `dir="ltr"` تا ترتیب نویسه‌ها در حالت RTL به‌هم نریزد. */
export function CommandLine({ children }: { children: ReactNode }) {
  return (
    <code
      dir="ltr"
      className="numeric inline-block rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-800"
    >
      {children}
    </code>
  );
}
