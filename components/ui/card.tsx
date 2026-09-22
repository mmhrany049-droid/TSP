import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/utils";

type DivProps = HTMLAttributes<HTMLDivElement>;

/** کارت پایه برای گروه‌بندی محتوا. */
export function Card({ className, ...props }: DivProps) {
  return (
    <section
      className={cn("rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-200/50", className)}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: DivProps) {
  return <header className={cn("flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5", className)} {...props} />;
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn("text-base font-semibold text-slate-900", className)} {...props} />;
}

export function CardDescription({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-sm text-slate-500", className)} {...props} />;
}

export function CardBody({ className, ...props }: DivProps) {
  return <div className={cn("p-5", className)} {...props} />;
}

export function CardFooter({ className, ...props }: DivProps) {
  return <footer className={cn("flex items-center gap-3 border-t border-slate-100 p-5", className)} {...props} />;
}

/** نمایش آمارهٔ کوتاه (عدد بزرگ + برچسب). */
export function StatCard({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <Card className="p-5">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-400">{hint}</p> : null}
    </Card>
  );
}
