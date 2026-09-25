const FA_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const MONTHS = [
  "فروردین",
  "اردیبهشت",
  "خرداد",
  "تیر",
  "مرداد",
  "شهریور",
  "مهر",
  "آبان",
  "آذر",
  "دی",
  "بهمن",
  "اسفند",
];

export function toFaDigits(value: string | number): string {
  return String(value).replace(/\d/g, (digit) => FA_DIGITS[Number(digit)] ?? digit);
}

export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  const rounded = Math.round(value * 10) / 10;
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return `${toFaDigits(text)}٪`;
}

export function formatCount(value: number): string {
  return toFaDigits(value);
}

export function formatSeconds(value: number | null): string {
  if (value === null) return "ثبت نشده";
  const minutes = Math.floor(value / 60);
  const seconds = value % 60;
  if (minutes === 0) return `${toFaDigits(seconds)} ثانیه`;
  return `${toFaDigits(minutes)}:${toFaDigits(String(seconds).padStart(2, "0"))}`;
}

export function parseApiDate(iso: string): Date {
  if (/[zZ]|[+-]\d{2}:\d{2}$/.test(iso)) return new Date(iso);
  return new Date(`${iso}Z`);
}

function div(a: number, b: number): number {
  return ~~(a / b);
}

export function toJalaali(gy: number, gm: number, gd: number): { jy: number; jm: number; jd: number } {
  const gDayNo = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  const gy2 = gm > 2 ? gy + 1 : gy;
  let days =
    355666 +
    365 * gy +
    div(gy2 + 3, 4) -
    div(gy2 + 99, 100) +
    div(gy2 + 399, 400) +
    gd +
    gDayNo[gm - 1];
  let jy = -1595 + 33 * div(days, 12053);
  days %= 12053;
  jy += 4 * div(days, 1461);
  days %= 1461;
  if (days > 365) {
    jy += div(days - 1, 365);
    days = (days - 1) % 365;
  }
  const jm = days < 186 ? 1 + div(days, 31) : 7 + div(days - 186, 30);
  const jd = 1 + (days < 186 ? days % 31 : (days - 186) % 30);
  return { jy, jm, jd };
}

export function formatJalali(iso: string): string {
  const date = parseApiDate(iso);
  if (Number.isNaN(date.getTime())) return "—";
  const { jy, jm, jd } = toJalaali(date.getFullYear(), date.getMonth() + 1, date.getDate());
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return toFaDigits(`${jd} ${MONTHS[jm - 1]} ${jy}، ${hours}:${minutes}`);
}

export function shortId(id: string): string {
  return id.replace(/-/g, "").slice(0, 8);
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return "خطای غیرمنتظره رخ داد.";
}
