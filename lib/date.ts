/**
 * تبدیل و قالب‌بندی تاریخ شمسی (جلالی).
 *
 * قواعد مهم این پروژه:
 *   • تاریخ‌ها همیشه به شکل میلادی/ISO در پایگاه داده ذخیره می‌شوند.
 *   • شمسی فقط برای **نمایش** و **ورود داده** استفاده می‌شود.
 *
 * الگوریتم این فایل همان الگوریتم کتابخانهٔ مرجع `jalaali-js` است و با مقایسهٔ
 * خروجی‌ها بررسی شده است (آزمون‌های `lib/date.test.ts`).
 */

const BREAKS = [
  -61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394,
  2456, 3178,
] as const;

export const JALALI_MONTHS = [
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
] as const;

/** ترتیب هفته در ایران: شنبه اولین روز هفته است. */
export const JALALI_WEEKDAYS = [
  "شنبه",
  "یک‌شنبه",
  "دوشنبه",
  "سه‌شنبه",
  "چهارشنبه",
  "پنج‌شنبه",
  "جمعه",
] as const;

export interface JalaliDate {
  year: number;
  month: number;
  day: number;
}

/** تقسیم صحیح با رفتار ریاضی (نه رفتار زبان‌های برنامه‌نویسی). */
function div(a: number, b: number): number {
  const quotient = Math.trunc(Math.abs(a) / Math.abs(b));

  return a < 0 !== b < 0 ? -quotient : quotient;
}

function mod(a: number, b: number): number {
  return a - div(a, b) * b;
}

interface JalCalResult {
  /** ۰ یعنی سال کبیسه، ۱ تا ۴ یعنی سال عادی */
  leap: number;
  gregorianYear: number;
  /** روز مارس که اول فروردین در آن است */
  march: number;
}

function jalCal(jalaliYear: number, withoutLeap = false): JalCalResult {
  const breakCount = BREAKS.length;
  const gregorianYear = jalaliYear + 621;
  let leapJ = -14;
  let previousBreak: number = BREAKS[0];

  if (jalaliYear < previousBreak || jalaliYear >= BREAKS[breakCount - 1]) {
    throw new RangeError(`سال شمسی نامعتبر است: ${jalaliYear}`);
  }

  let jump = 0;

  for (let index = 1; index < breakCount; index += 1) {
    const currentBreak = BREAKS[index];
    jump = currentBreak - previousBreak;

    if (jalaliYear < currentBreak) {
      break;
    }

    leapJ += div(jump, 33) * 8 + div(mod(jump, 33), 4);
    previousBreak = currentBreak;
  }

  const passed = jalaliYear - previousBreak;
  leapJ += div(passed, 33) * 8 + div(mod(passed, 33) + 3, 4);

  if (mod(jump, 33) === 4 && jump - passed === 4) {
    leapJ += 1;
  }

  const leapG = div(gregorianYear, 4) - div((div(gregorianYear, 100) + 1) * 3, 4) - 150;
  const march = 20 + leapJ - leapG;

  if (withoutLeap) {
    return { leap: 0, gregorianYear, march };
  }

  const remaining = jump - passed < 6 ? passed - jump + div(jump + 4, 33) * 33 : passed;
  let leap = mod(mod(remaining + 1, 33) - 1, 4);

  if (leap === -1) {
    leap = 4;
  }

  return { leap, gregorianYear, march };
}

/** شمار روزهای یک ماه شمسی. */
export function jalaliMonthLength(jalaliYear: number, jalaliMonth: number): number {
  if (jalaliMonth <= 6) {
    return 31;
  }

  if (jalaliMonth <= 11) {
    return 30;
  }

  return isLeapJalaliYear(jalaliYear) ? 30 : 29;
}

/** سال کبیسهٔ شمسی (اسفند ۳۰ روز). */
export function isLeapJalaliYear(jalaliYear: number): boolean {
  return jalCal(jalaliYear).leap === 0;
}

/** شماره روز در سال شمسی، صفر-پایه. */
function dayOfYearOffset(jalaliMonth: number, jalaliDay: number): number {
  return (jalaliMonth - 1) * 31 - Math.floor(jalaliMonth / 7) * (jalaliMonth - 7) + (jalaliDay - 1);
}

/** تبدیل تاریخ شمسی به میلادی. ساعت همیشه ۰۰:۰۰ به وقت محلی است. */
export function jalaliToGregorian({ year, month, day }: JalaliDate): Date {
  if (month < 1 || month > 12) {
    throw new RangeError("ماه شمسی باید بین ۱ تا ۱۲ باشد");
  }

  const monthLength = jalaliMonthLength(year, month);

  if (day < 1 || day > monthLength) {
    throw new RangeError(`روز ${day} برای این ماه وجود ندارد (حداکثر ${monthLength})`);
  }

  const { gregorianYear, march } = jalCal(year, true);
  const firstDayOfYear = new Date(gregorianYear, 2, march);
  firstDayOfYear.setDate(firstDayOfYear.getDate() + dayOfYearOffset(month, day));

  return firstDayOfYear;
}

/** تبدیل تاریخ میلادی به شمسی. ساعت ورودی نادیده گرفته می‌شود (تاریخ، نه لحظه). */
export function gregorianToJalali(value: Date): JalaliDate {
  // ساعت حذف می‌شود تا اختلاف روزها، عدد صحیح بماند
  const date = new Date(value.getFullYear(), value.getMonth(), value.getDate());
  let year = date.getFullYear() - 621;
  let firstDayOfYear = (() => {
    const { gregorianYear, march } = jalCal(year, true);

    return new Date(gregorianYear, 2, march);
  })();

  if (date.getTime() < firstDayOfYear.getTime()) {
    // تاریخ پیش از اول فروردینِ همان سال شمسی است
    year -= 1;
    const { gregorianYear, march } = jalCal(year, true);
    firstDayOfYear = new Date(gregorianYear, 2, march);
  }

  const offset = Math.round((date.getTime() - firstDayOfYear.getTime()) / 86_400_000);

  if (offset <= 185) {
    return { year, month: Math.floor(offset / 31) + 1, day: (offset % 31) + 1 };
  }

  const rest = offset - 186;

  return { year, month: 7 + Math.floor(rest / 30), day: (rest % 30) + 1 };
}

/** تبدیل رشته/عدد به تاریخ؛ ورودی نامعتبر `null` می‌شود. */
export function toDate(value: Date | string | number | null | undefined): Date | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = value instanceof Date ? value : new Date(value);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export interface FormatJalaliOptions {
  /** ارقام را فارسی نشان بده (پیش‌فرض: بله) */
  persianDigits?: boolean;
  /** نام روز هفته را ابتدای تاریخ بیاور */
  withWeekday?: boolean;
  /** شکل خوانا: «۳۱ شهریور ۱۴۰۴» */
  long?: boolean;
  /** نمایش ساعت به شکل «۱۴:۳۰» */
  withTime?: boolean;
}

const PERSIAN_DIGITS = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"] as const;

/** ارقام لاتین را به ارقام فارسی تبدیل می‌کند. */
export function toPersianDigits(input: string | number): string {
  return String(input).replace(/\d/g, (digit) => PERSIAN_DIGITS[Number(digit)]);
}

function pad(value: number): string {
  return value.toString().padStart(2, "0");
}

/**
 * قالب‌بندی تاریخ به شمسی.
 *
 * ```ts
 * formatJalali(new Date("2025-09-22"));                    // «۱۴۰۴/۰۶/۳۱»
 * formatJalali(new Date("2025-09-22"), { long: true });    // «۳۱ شهریور ۱۴۰۴»
 * ```
 */
export function formatJalali(
  value: Date | string | number | null | undefined,
  options: FormatJalaliOptions = {},
): string {
  const date = toDate(value);

  if (!date) {
    return "—";
  }

  const { persianDigits = true, withWeekday = false, long = false, withTime = false } = options;
  const { year, month, day } = gregorianToJalali(date);

  let text = long ? `${day} ${JALALI_MONTHS[month - 1]} ${year}` : `${year}/${pad(month)}/${pad(day)}`;

  if (withWeekday) {
    // در جاوااسکریپت یک‌شنبه = ۰ است؛ در تقویم ایران شنبه = ۰
    const weekday = JALALI_WEEKDAYS[(date.getDay() + 1) % 7];
    text = `${weekday} ${text}`;
  }

  if (withTime) {
    text = `${text} — ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  return persianDigits ? toPersianDigits(text) : text;
}

/** تاریخ امروز به شمسی. */
export function jalaliToday(options: FormatJalaliOptions = {}): string {
  return formatJalali(new Date(), options);
}

const JALALI_PATTERN = /^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})(?:[\sT](\d{1,2}):(\d{1,2}))?$/;

/**
 * خواندن تاریخ شمسی از ورودی کاربر.
 *
 * ```ts
 * parseJalali("1404/06/31");      // Date معادل ۲۰۲۵-۰۹-۲۲
 * parseJalali("1404/6/31 14:30"); // همان روز، ساعت ۱۴:۳۰
 * ```
 */
export function parseJalali(input: string | null | undefined): Date | null {
  if (!input) {
    return null;
  }

  const normalized = toEnglishDigits(input.trim());
  const matched = JALALI_PATTERN.exec(normalized);

  if (!matched) {
    return null;
  }

  const [, year, month, day, hours, minutes] = matched;

  try {
    const date = jalaliToGregorian({
      year: Number(year),
      month: Number(month),
      day: Number(day),
    });

    date.setHours(Number(hours ?? 0), Number(minutes ?? 0), 0, 0);

    return date;
  } catch {
    return null;
  }
}

const ARABIC_INDIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

/** ارقام فارسی/عربی را به لاتین برمی‌گرداند (برای پردازش ورودی کاربر). */
export function toEnglishDigits(input: string): string {
  return input
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String(ARABIC_INDIC_DIGITS.indexOf(digit)));
}
