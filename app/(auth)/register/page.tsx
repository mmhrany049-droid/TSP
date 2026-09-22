import type { Metadata } from "next";

import { RegisterForm } from "@/components/auth/register-form";
import { DatabaseNotice } from "@/components/db-notice";
import { EnvNotice } from "@/components/env-notice";
import { getDatabaseStatus } from "@/lib/db-status";

export const metadata: Metadata = {
  title: "ثبت‌نام",
  description: "ساخت حساب کاربری تازه در TSP",
};

/*
 * این صفحه باید همیشه تازه ساخته شود، چون وضعیت پایگاه داده و تنظیمات محیطی
 * ممکن است در هر اجرا متفاوت باشد (و صفحهٔ ذخیره‌شدهٔ قدیمی کاربر را گمراه کند).
 */
export const dynamic = "force-dynamic";

/**
 * صفحهٔ ثبت‌نام.
 *
 * اولین حسابی که ساخته می‌شود، صاحب همان پایگاه دادهٔ محلی است.
 * اگر پایگاه داده آماده نباشد، فرم غیرفعال می‌شود و به‌جای خطا، راهنمای ساخت
 * پایگاه داده نمایش داده می‌شود.
 */
export default async function RegisterPage() {
  const databaseStatus = await getDatabaseStatus();
  const databaseReady = databaseStatus.state === "ready";

  return (
    <div className="space-y-4">
      <EnvNotice />

      {databaseReady ? null : <DatabaseNotice />}

      <RegisterForm
        disabled={!databaseReady}
        disabledReason={`${databaseStatus.message} ${databaseStatus.hint}`.trim()}
      />
    </div>
  );
}
