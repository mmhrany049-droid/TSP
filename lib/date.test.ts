import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  formatJalali,
  gregorianToJalali,
  isLeapJalaliYear,
  jalaliMonthLength,
  jalaliToGregorian,
  parseJalali,
  toEnglishDigits,
  toPersianDigits,
} from "./date.ts";

/**
 * اجرا:
 *   npm run test:unit
 *
 * مقادیر مرجع از کتابخانهٔ `jalaali-js` گرفته شده‌اند؛ این آزمون‌ها تضمین می‌کنند
 * تبدیل تاریخ‌ها پس از هر تغییر سالم بماند.
 */
describe("تبدیل شمسی ↔ میلادی", () => {
  const anchors: Array<[number, number, number, string]> = [
    [1404, 1, 1, "2025-03-21"],
    [1404, 6, 31, "2025-09-22"],
    [1404, 7, 15, "2025-10-07"],
    [1403, 12, 29, "2025-03-19"],
    [1399, 12, 30, "2021-03-20"],
    [1404, 12, 29, "2026-03-20"],
    [1357, 11, 22, "1979-02-11"],
    [1378, 12, 10, "2000-02-29"],
  ];

  for (const [year, month, day, iso] of anchors) {
    it(`شمسی ${year}/${month}/${day} → ${iso}`, () => {
      const date = jalaliToGregorian({ year, month, day });
      const isoDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
        date.getDate(),
      ).padStart(2, "0")}`;

      assert.equal(isoDate, iso);
    });

    it(`میلادی ${iso} → شمسی ${year}/${month}/${day}`, () => {
      const converted = gregorianToJalali(new Date(`${iso}T12:00:00`));

      assert.deepEqual(converted, { year, month, day });
    });
  }

  it("سال‌های کبیسه درست تشخیص داده می‌شوند", () => {
    assert.equal(isLeapJalaliYear(1403), true);
    assert.equal(isLeapJalaliYear(1404), false);
    assert.equal(isLeapJalaliYear(1399), true);
    assert.equal(jalaliMonthLength(1403, 12), 30);
    assert.equal(jalaliMonthLength(1404, 12), 29);
  });

  it("روز نامعتبر رد می‌شود", () => {
    assert.throws(() => jalaliToGregorian({ year: 1404, month: 12, day: 30 }), RangeError);
    assert.throws(() => jalaliToGregorian({ year: 1404, month: 13, day: 1 }), RangeError);
  });

  it("رفت‌وبرگشت ۲۰۰ سال پیوسته بدون خطا انجام می‌شود", () => {
    const start = jalaliToGregorian({ year: 1300, month: 1, day: 1 });
    const end = jalaliToGregorian({ year: 1420, month: 1, day: 1 });

    for (let time = start.getTime(); time < end.getTime(); time += 86_400_000) {
      const date = new Date(time);
      const jalali = gregorianToJalali(date);
      const back = jalaliToGregorian(jalali);

      assert.equal(back.getFullYear(), date.getFullYear());
      assert.equal(back.getMonth(), date.getMonth());
      assert.equal(back.getDate(), date.getDate());
    }
  });
});

describe("قالب‌بندی و ورود داده", () => {
  it("قالب‌بندی کوتاه، بلند، روز هفته و ساعت", () => {
    const date = new Date("2025-09-22T14:30:00");

    assert.equal(formatJalali(date), "۱۴۰۴/۰۶/۳۱");
    assert.equal(formatJalali(date, { persianDigits: false }), "1404/06/31");
    assert.equal(formatJalali(date, { long: true }), "۳۱ شهریور ۱۴۰۴");
    assert.equal(formatJalali(date, { long: true, persianDigits: false, withWeekday: true }),
      "دوشنبه 31 شهریور 1404");
    assert.equal(formatJalali(date, { withTime: true }), "۱۴۰۴/۰۶/۳۱ — ۱۴:۳۰");
    assert.equal(formatJalali(null), "—");
  });

  it("ورودی تاریخ شمسی خوانده می‌شود", () => {
    const parsed = parseJalali("1404/06/31 14:30");

    assert.ok(parsed);
    assert.equal(parsed.getFullYear(), 2025);
    assert.equal(parsed.getMonth(), 8); // سپتامبر
    assert.equal(parsed.getDate(), 22);
    assert.equal(parsed.getHours(), 14);
    assert.equal(parsed.getMinutes(), 30);
    // ارقام فارسی و ورودی بدون ساعت هم باید همان روز را بدهند
    const withPersianDigits = parseJalali("۱۴۰۴/۰۶/۳۱");
    const dateOnly = parseJalali("1404/06/31");
    assert.equal(withPersianDigits?.getTime(), dateOnly?.getTime());
    assert.equal(dateOnly?.getDate(), 22);
    assert.equal(parseJalali("تاریخ نامعتبر"), null);
    assert.equal(parseJalali("1404/13/01"), null);
  });

  it("تبدیل ارقام فارسی و لاتین", () => {
    assert.equal(toPersianDigits(1404), "۱۴۰۴");
    assert.equal(toPersianDigits("Q-000184"), "Q-۰۰۰۱۸۴");
    assert.equal(toEnglishDigits("۱۴۰۴/۰۶/۳۱"), "1404/06/31");
  });
});
