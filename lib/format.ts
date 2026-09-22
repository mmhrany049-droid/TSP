import { toPersianDigits } from "./date";

export { toPersianDigits };

/** عدد را با جداکنندهٔ هزارگان و ارقام فارسی نمایش می‌دهد. */
export function formatNumber(value: number | null | undefined, options: { persianDigits?: boolean } = {}): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "—";
  }

  const text = new Intl.NumberFormat("en-US").format(value);

  return options.persianDigits === false ? text : toPersianDigits(text);
}

/** درصد را با یک رقم اعشار نمایش می‌دهد. */
export function formatPercent(
  value: number | null | undefined,
  options: { persianDigits?: boolean; withSign?: boolean } = {},
): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "—";
  }

  const rounded = Math.round(value * 10) / 10;
  const text = `${rounded}%${options.withSign ? "" : ""}`;

  return options.persianDigits === false ? text : toPersianDigits(text);
}

/** مدت‌زمان را از ثانیه به شکل «۱:۰۵» یا «۲:۰۳:۱۵» نمایش می‌دهد. */
export function formatDuration(seconds: number | null | undefined, persianDigits = true): string {
  if (seconds === null || seconds === undefined || seconds < 0) {
    return "—";
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = Math.floor(seconds % 60);
  const pad = (value: number) => value.toString().padStart(2, "0");
  const text = hours > 0 ? `${hours}:${pad(minutes)}:${pad(rest)}` : `${minutes}:${pad(rest)}`;

  return persianDigits ? toPersianDigits(text) : text;
}

/** شمارهٔ تست را همیشه با ارقام لاتین (برای جست‌وجو و مرتب‌سازی) نگه می‌دارد. */
export function formatQuestionNumber(displayNumber: string | null | undefined): string {
  return displayNumber?.trim() || "—";
}

/** متن‌های خالی را به خط تیره تبدیل می‌کند تا جدول‌ها یکدست بمانند. */
export function orDash(value: string | null | undefined): string {
  const text = value?.trim();

  return text && text.length > 0 ? text : "—";
}
