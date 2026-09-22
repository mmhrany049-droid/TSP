import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { cn, safeCallbackUrl } from "./utils.ts";

describe("cn", () => {
  it("کلاس‌های متناقض Tailwind را حل می‌کند", () => {
    assert.equal(cn("p-2", "p-4"), "p-4");
    assert.equal(cn("text-sm", false && "hidden", "font-bold"), "text-sm font-bold");
  });
});

describe("safeCallbackUrl", () => {
  it("مسیر داخلی معتبر را نگه می‌دارد", () => {
    assert.equal(safeCallbackUrl("/books"), "/books");
    assert.equal(safeCallbackUrl("/questions?q=12"), "/questions?q=12");
  });

  it("آدرس مطلق (شکل خروجی NextAuth) را به مسیر همان دامنه تبدیل می‌کند", () => {
    assert.equal(safeCallbackUrl("http://localhost:3000/books"), "/books");
    assert.equal(safeCallbackUrl("http://localhost:3000/login?callbackUrl=/books"), "/login?callbackUrl=/books");
  });

  it("دامنهٔ بیرونی را حذف می‌کند و فقط مسیر را نگه می‌دارد", () => {
    assert.equal(safeCallbackUrl("https://evil.example/steal"), "/steal");
    assert.equal(safeCallbackUrl("https://evil.example"), "/");
  });

  it("مقدارهای ناامن را به مقصد پیش‌فرض برمی‌گرداند", () => {
    assert.equal(safeCallbackUrl("//evil.example"), "/");
    assert.equal(safeCallbackUrl("/\\evil.example"), "/");
    assert.equal(safeCallbackUrl("javascript:alert(1)"), "/");
  });

  it("برای مقدار خالی، مقصد پیش‌فرض (یا مقدار دلخواه) را برمی‌گرداند", () => {
    assert.equal(safeCallbackUrl(undefined), "/");
    assert.equal(safeCallbackUrl(""), "/");
    assert.equal(safeCallbackUrl("   "), "/");
    assert.equal(safeCallbackUrl(undefined, "/review"), "/review");
  });
});
