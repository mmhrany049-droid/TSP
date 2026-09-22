import type { Metadata } from "next";

import { LoginForm } from "@/components/auth/login-form";
import { DatabaseNotice } from "@/components/db-notice";
import { EnvNotice } from "@/components/env-notice";
import { DEFAULT_LOGIN_REDIRECT } from "@/lib/auth.config";
import { getDatabaseStatus } from "@/lib/db-status";
import { safeCallbackUrl } from "@/lib/utils";

export const metadata: Metadata = {
  title: "ورود",
  description: "ورود به حساب کاربری TSP",
};

/*
 * این صفحه باید همیشه تازه ساخته شود، چون:
 *   • وضعیت پایگاه داده و تنظیمات محیطی در هر لحظه می‌تواند تغییر کند؛
 *   • کاربر واردشده نباید نسخهٔ ذخیره‌شدهٔ صفحهٔ ورود را ببیند.
 */
export const dynamic = "force-dynamic";

/**
 * صفحهٔ ورود.
 *
 * اگر کاربر به‌خاطر محافظت میدل‌ور به اینجا آمده باشد، پارامتر `callbackUrl` مسیر
 * درخواستی او را نگه داشته است؛ پس از ورود به همان مسیر برمی‌گردد.
 *
 * نکتهٔ مهم: این صفحه هرگز نباید «صفحهٔ سفید» یا خطای ۵۰۰ بدهد. اگر پایگاه داده
 * ساخته نشده باشد، فرم غیرفعال می‌شود و کادر راهنما دستور لازم را نشان می‌دهد.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const params = await searchParams;
  const callbackUrl = safeCallbackUrl(params.callbackUrl, DEFAULT_LOGIN_REDIRECT);
  const databaseStatus = await getDatabaseStatus();
  const databaseReady = databaseStatus.state === "ready";

  return (
    <div className="space-y-4">
      <EnvNotice />

      {databaseReady ? null : <DatabaseNotice />}

      <LoginForm
        callbackUrl={callbackUrl}
        disabled={!databaseReady}
        disabledReason={`${databaseStatus.message} ${databaseStatus.hint}`.trim()}
      />
    </div>
  );
}
