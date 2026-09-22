import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * ترکیب کلاس‌های Tailwind با حل تعارض‌ها.
 *
 * ```tsx
 * <div className={cn("p-2", isActive && "bg-blue-500", className)} />
 * ```
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** رشتهٔ خالی، فاصله‌های اضافی و `null` را به `undefined` تبدیل می‌کند (برای فیلدهای اختیاری). */
export function optionalText(value: FormDataEntryValue | string | null | undefined): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : undefined;
}
