import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  formatDuration,
  formatNumber,
  formatPercent,
  formatQuestionNumber,
  orDash,
  toPersianDigits,
} from "./format.ts";

describe("toPersianDigits", () => {
  it("رقم‌های لاتین را فارسی می‌کند", () => {
    assert.equal(toPersianDigits("0123456789"), "۰۱۲۳۴۵۶۷۸۹");
    assert.equal(toPersianDigits(1404), "۱۴۰۴");
  });

  it("متن بدون رقم را دست‌نخورده برمی‌گرداند", () => {
    assert.equal(toPersianDigits("فصل اول"), "فصل اول");
  });
});

describe("formatNumber", () => {
  it("جداکنندهٔ هزارگان و رقم فارسی می‌گذارد", () => {
    assert.equal(formatNumber(0), "۰");
    assert.equal(formatNumber(999), "۹۹۹");
    assert.equal(formatNumber(1234), "۱,۲۳۴");
  });

  it("با `persianDigits: false` رقم‌ها را لاتین نگه می‌دارد", () => {
    assert.equal(formatNumber(1234, { persianDigits: false }), "1,234");
  });

  it("برای مقدار نامعلوم خط تیره می‌گذارد", () => {
    assert.equal(formatNumber(null), "—");
    assert.equal(formatNumber(undefined), "—");
    assert.equal(formatNumber(Number.NaN), "—");
  });
});

describe("formatPercent", () => {
  it("درصد را با یک رقم اعشار و علامت درصد می‌دهد", () => {
    assert.equal(formatPercent(62.5), "۶۲.۵%");
    assert.equal(formatPercent(100), "۱۰۰%");
    assert.equal(formatPercent(33.333), "۳۳.۳%");
  });

  it("برای مقدار نامعلوم خط تیره می‌گذارد", () => {
    assert.equal(formatPercent(null), "—");
  });
});

describe("formatDuration", () => {
  it("ثانیه را به دقیقه و ساعت خوانا تبدیل می‌کند", () => {
    assert.equal(formatDuration(65), "۱:۰۵");
    assert.equal(formatDuration(3750), "۱:۰۲:۳۰");
    assert.equal(formatDuration(0), "۰:۰۰");
  });

  it("با ارقام لاتین هم می‌تواند نمایش دهد", () => {
    assert.equal(formatDuration(125, false), "2:05");
  });

  it("برای مقدار نامعتبر خط تیره می‌گذارد", () => {
    assert.equal(formatDuration(null), "—");
    assert.equal(formatDuration(-5), "—");
  });
});

describe("formatQuestionNumber و orDash", () => {
  it("شمارهٔ نمایشی خالی را با خط تیره نشان می‌دهد", () => {
    assert.equal(formatQuestionNumber("۱۲۳"), "۱۲۳");
    assert.equal(formatQuestionNumber("  "), "—");
    assert.equal(formatQuestionNumber(null), "—");
  });

  it("متن خالی را خط تیره می‌کند", () => {
    assert.equal(orDash("خیلی سبز"), "خیلی سبز");
    assert.equal(orDash("   "), "—");
    assert.equal(orDash(undefined), "—");
  });
});
