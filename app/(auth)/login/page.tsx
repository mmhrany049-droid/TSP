import type { Metadata } from "next";

import { LoginForm } from "@/components/auth/login-form";
import { DEFAULT_LOGIN_REDIRECT } from "@/lib/auth.config";
import { safeCallbackUrl } from "@/lib/utils";

export const metadata: Metadata = {
  title: "ورود",
  description: "ورود به حساب کاربری TSP",
};

/**
 * صفحهٔ ورود.
 *
 * اگر کاربر به‌خاطر محافظت میدل‌ور به اینجا آمده باشد، پارامتر `callbackUrl` مسیر
 * درخواستی او را نگه داشته است؛ پس از ورود به همان مسیر برمی‌گردد.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const params = await searchParams;
  const callbackUrl = safeCallbackUrl(params.callbackUrl, DEFAULT_LOGIN_REDIRECT);

  return <LoginForm callbackUrl={callbackUrl} />;
}
