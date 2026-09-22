import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DEVELOPMENT_AUTH_SECRET,
  MIN_AUTH_SECRET_LENGTH,
  resolveAuthSecret,
  resolveAuthSecretState,
} from "./auth-secret.ts";

/**
 * آزمون‌های منطق انتخاب کلید امضای نشست.
 *
 * این منطق حیاتی است: تفاوت رفتار بین دو حالت «توسعه» و «تولید» است و اگر اشتباه
 * شود، یا برنامه بدون `.env` بالا نمی‌آید یا در تولید با کلید ناامن اجرا می‌شود.
 */

/** اجرای یک قطعه کد با مقادیر موقت متغیرهای محیطی. */
function withEnv<T>(values: Record<string, string | undefined>, run: () => T): T {
  const previous = {
    AUTH_SECRET: process.env.AUTH_SECRET,
    NODE_ENV: process.env.NODE_ENV,
  };

  try {
    for (const [key, value] of Object.entries(values)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }

    return run();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

describe("resolveAuthSecretState", () => {
  it("کلید تنظیم‌شدهٔ معتبر را برمی‌گرداند", () => {
    const state = withEnv({ AUTH_SECRET: "a".repeat(32), NODE_ENV: "development" }, () =>
      resolveAuthSecretState(),
    );

    assert.equal(state.secret, "a".repeat(32));
    assert.equal(state.isConfigured, true);
    assert.equal(state.isDevelopmentFallback, false);
    assert.equal(state.isMissingInProduction, false);
  });

  it("در حالت توسعه و بدون کلید، کلید موقت ثابت می‌گذارد", () => {
    const state = withEnv({ AUTH_SECRET: undefined, NODE_ENV: "development" }, () =>
      resolveAuthSecretState(),
    );

    assert.equal(state.secret, DEVELOPMENT_AUTH_SECRET);
    assert.equal(state.isConfigured, false);
    assert.equal(state.isDevelopmentFallback, true);
    assert.equal(state.isMissingInProduction, false);
  });

  it("کلید کوتاه‌تر از حد مجاز را نامعتبر می‌شمارد", () => {
    const short = "x".repeat(MIN_AUTH_SECRET_LENGTH - 1);
    const state = withEnv({ AUTH_SECRET: short, NODE_ENV: "development" }, () =>
      resolveAuthSecretState(),
    );

    assert.equal(state.isConfigured, false);
    assert.equal(state.secret, DEVELOPMENT_AUTH_SECRET);
  });

  it("در حالت تولید و بدون کلید، هیچ کلیدی نمی‌دهد (وضعیت بحرانی)", () => {
    const state = withEnv({ AUTH_SECRET: undefined, NODE_ENV: "production" }, () =>
      resolveAuthSecretState(),
    );

    assert.equal(state.secret, undefined);
    assert.equal(state.isConfigured, false);
    assert.equal(state.isDevelopmentFallback, false);
    assert.equal(state.isMissingInProduction, true);
  });

  it("کلید موقت توسعه هرگز در حالت تولید استفاده نمی‌شود", () => {
    const secret = withEnv({ AUTH_SECRET: undefined, NODE_ENV: "production" }, () =>
      resolveAuthSecret(),
    );

    assert.notEqual(secret, DEVELOPMENT_AUTH_SECRET);
    assert.equal(secret, undefined);
  });

  it("کلید موقت توسعه ثابت است تا میدل‌ور (Edge) و سرور (Node) هم‌خوان بمانند", () => {
    const first = withEnv({ AUTH_SECRET: undefined, NODE_ENV: "development" }, () => resolveAuthSecret());
    const second = withEnv({ AUTH_SECRET: undefined, NODE_ENV: "development" }, () => resolveAuthSecret());

    // اگر این دو مقدار یکی نباشند، کوکی نشست در یکی از دو محیط نامعتبر می‌شود و
    // کاربر در حلقهٔ ریدایرکت بین «/» و «/login» می‌افتد.
    assert.equal(first, second);
  });
});
