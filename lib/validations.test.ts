import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { loginSchema, registerSchema, zodFieldErrors } from "./validations.ts";

describe("loginSchema", () => {
  it("ورودی درست را می‌پذیرد و ایمیل را نرمال می‌کند", () => {
    const result = loginSchema.safeParse({ email: "  Student@Example.COM ", password: "secret123" });

    assert.equal(result.success, true);
    assert.equal(result.success && result.data.email, "student@example.com");
  });

  it("ایمیل خالی یا نامعتبر را رد می‌کند", () => {
    assert.equal(loginSchema.safeParse({ email: "", password: "secret123" }).success, false);
    assert.equal(loginSchema.safeParse({ email: "not-an-email", password: "secret123" }).success, false);
  });

  it("گذرواژهٔ خالی را رد می‌کند", () => {
    const result = loginSchema.safeParse({ email: "student@example.com", password: "" });

    assert.equal(result.success, false);
    assert.equal(result.success === false && result.error.issues[0].message, "گذرواژه را وارد کنید.");
  });
});

describe("registerSchema", () => {
  const validPayload = {
    name: "محمد حسین‌زاده",
    email: "student@example.com",
    password: "secret123",
    confirmPassword: "secret123",
  };

  it("ورودی کامل و درست را می‌پذیرد", () => {
    assert.equal(registerSchema.safeParse(validPayload).success, true);
  });

  it("گذرواژهٔ کوتاه‌تر از ۸ نویسه را رد می‌کند", () => {
    const result = registerSchema.safeParse({ ...validPayload, password: "short", confirmPassword: "short" });

    assert.equal(result.success, false);
    assert.equal(result.success === false && result.error.issues[0].message, "گذرواژه باید حداقل ۸ نویسه باشد.");
  });

  it("ناهمخوانی تکرار گذرواژه را زیر همان فیلد گزارش می‌کند", () => {
    const result = registerSchema.safeParse({ ...validPayload, confirmPassword: "secret124" });

    assert.equal(result.success, false);
    assert.equal(result.success === false && result.error.issues[0].path[0], "confirmPassword");
    assert.equal(
      result.success === false && result.error.issues[0].message,
      "تکرار گذرواژه با گذرواژه یکسان نیست.",
    );
  });

  it("نام کوتاه‌تر از ۲ نویسه را رد می‌کند", () => {
    assert.equal(registerSchema.safeParse({ ...validPayload, name: "م" }).success, false);
  });
});

describe("zodFieldErrors", () => {
  it("برای هر فیلد نخستین پیام فارسی را برمی‌گرداند", () => {
    const result = registerSchema.safeParse({
      name: "",
      email: "bad",
      password: "123",
      confirmPassword: "456",
    });

    assert.equal(result.success, false);

    if (result.success) {
      return;
    }

    const fieldErrors = zodFieldErrors(result.error);

    assert.equal(typeof fieldErrors.name, "string");
    assert.equal(fieldErrors.email, "ایمیل معتبر نیست.");
    assert.equal(fieldErrors.password, "گذرواژه باید حداقل ۸ نویسه باشد.");
    assert.equal(fieldErrors.confirmPassword, "تکرار گذرواژه با گذرواژه یکسان نیست.");
  });
});
