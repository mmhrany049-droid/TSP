import Link from "next/link";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import type { Result } from "@/types";
import { RESULT_LABELS } from "@/lib/labels";
import { formatPercent } from "@/lib/format";

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

const control =
  "w-full rounded-xl border border-line bg-white px-3 text-ink outline-none transition placeholder:text-muted/70 focus:border-pine focus:ring-4 focus:ring-pine/15";

export function Button({
  variant = "primary",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger" }) {
  const styles = {
    primary: "bg-pine text-white hover:bg-pine-dark disabled:bg-pine/50",
    secondary: "border border-line bg-white text-ink hover:bg-foam disabled:opacity-60",
    ghost: "text-ink hover:bg-black/5 disabled:opacity-50",
    danger: "border border-[#f0c7c3] bg-white text-bad hover:bg-[#fff5f4] disabled:opacity-50",
  }[variant];
  return (
    <button
      className={cx(
        "inline-flex h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition disabled:cursor-not-allowed",
        styles,
        className,
      )}
      {...props}
    />
  );
}

export function TextInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cx(control, "h-11", className)} {...props} />;
}

export function TextArea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cx(control, "min-h-28 py-3", className)} {...props} />;
}

export function SelectInput({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cx(control, "h-11", className)} {...props}>
      {children}
    </select>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="block text-sm font-medium text-ink">{label}</span>
      {children}
      {hint ? <span className="block text-xs leading-6 text-muted">{hint}</span> : null}
    </label>
  );
}

export function Alert({
  tone = "error",
  children,
}: {
  tone?: "error" | "info" | "success";
  children: ReactNode;
}) {
  const styles = {
    error: "border-[#f0c7c3] bg-[#fff5f4] text-bad",
    info: "border-[#d5e4e1] bg-foam text-pine-dark",
    success: "border-[#b7e4c9] bg-[#f3fbf6] text-good",
  }[tone];
  return <div className={cx("rounded-xl border px-3 py-2.5 text-sm leading-7", styles)}>{children}</div>;
}

export function ResultBadge({ result }: { result: Result | null }) {
  if (!result) return <span className="text-sm text-muted">حل‌نشده</span>;
  const styles = {
    correct: "bg-[#e7f6ee] text-good",
    wrong: "bg-[#fdecec] text-bad",
    unanswered: "bg-[#fff6e5] text-warn",
  }[result];
  return (
    <span className={cx("inline-flex rounded-full px-2.5 py-1 text-xs font-bold", styles)}>
      {RESULT_LABELS[result]}
    </span>
  );
}

export function PercentBar({
  label,
  value,
  detail,
}: {
  label: string;
  value: number | null;
  detail?: string;
}) {
  const width = value === null ? 0 : Math.max(0, Math.min(100, value));
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="font-medium">{label}</span>
        <span className="font-bold tabular-nums">{formatPercent(value)}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[#efe8dc]">
        <div className="h-full rounded-full bg-pine transition-all" style={{ width: `${width}%` }} />
      </div>
      {detail ? <p className="text-xs text-muted">{detail}</p> : null}
    </div>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-line bg-white/60 px-5 py-10 text-center">
      <h3 className="text-lg font-bold">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-7 text-muted">{body}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function Spinner({ label = "در حال بارگذاری..." }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-sm text-muted">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-pine/30 border-t-pine" />
      {label}
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow ? <p className="mb-1 text-xs font-semibold text-pine">{eyebrow}</p> : null}
        <h1 className="text-2xl font-extrabold tracking-normal sm:text-3xl">{title}</h1>
        {description ? <p className="mt-2 max-w-2xl text-sm leading-7 text-muted">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function TextLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="font-semibold text-pine underline-offset-4 hover:underline">
      {children}
    </Link>
  );
}
