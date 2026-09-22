"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Loader2, LogIn } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardBody, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FormAlert } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { loginSchema, zodFieldErrors } from "@/lib/validations";

/**
 * فرم ورود.
 *
 * از `signIn` کلاینت NextAuth با `redirect: false` استفاده می‌کند تا اگر گذرواژه
 * نادرست بود، پیام فارسی همان‌جا زیر فرم بماند و کاربر به صفحهٔ خطای انگلیسی
 * هدایت نشود. پس از ورود موفق، مقصد `callbackUrl` (اگر امن باشد) باز می‌شود.
 */
export function LoginForm({
  callbackUrl = "/",
  disabled = false,
  disabledReason,
}: {
  callbackUrl?: string;
  /** وقتی پایگاه داده آماده نیست، فرم غیرفعال می‌شود تا خطای مبهم نگیریم. */
  disabled?: boolean;
  /** توضیح فارسی دلیل غیرفعال بودن فرم. */
  disabledReason?: string;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (disabled) {
      setFormError(disabledReason ?? "پایگاه داده آماده نیست؛ ابتدا دستور npm run db:setup را اجرا کنید.");
      return;
    }

    setFormError(null);
    setFieldErrors({});

    const parsed = loginSchema.safeParse({ email, password });

    if (!parsed.success) {
      setFieldErrors(zodFieldErrors(parsed.error));
      return;
    }

    setIsPending(true);

    try {
      const result = await signIn("credentials", {
        email: parsed.data.email,
        password: parsed.data.password,
        redirect: false,
      });

      // در حالت `redirect: false`، شکست با پر بودن `error` و خالی بودن `url`
      // مشخص می‌شود (کد HTTP در هر دو حالت ۲۰۰ است).
      if (result?.error || !result?.url) {
        setFormError(
          result?.error === "CredentialsSignin"
            ? "ایمیل یا گذرواژه نادرست است."
            : "ورود انجام نشد؛ لطفاً دوباره تلاش کنید.",
        );
        return;
      }

      router.replace(callbackUrl);
      // سرور کامپوننت‌ها باید با نشست تازه دوباره ساخته شوند.
      router.refresh();
    } catch {
      setFormError("ارتباط با سرور برقرار نشد؛ اینترنت یا اجرای برنامه را بررسی کنید.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>ورود به حساب</CardTitle>
        <span className="text-xs text-slate-400">با ایمیل و گذرواژه</span>
      </CardHeader>

      <form onSubmit={handleSubmit} noValidate>
        <CardBody className="space-y-4">
          {formError ? <FormAlert>{formError}</FormAlert> : null}

          <Field id="email" label="ایمیل" required error={fieldErrors.email}>
            <Input
              id="email"
              name="email"
              type="email"
              dir="ltr"
              autoComplete="email"
              placeholder="student@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              aria-invalid={Boolean(fieldErrors.email)}
              disabled={isPending || disabled}
              required
            />
          </Field>

          <Field id="password" label="گذرواژه" required error={fieldErrors.password}>
            <Input
              id="password"
              name="password"
              type="password"
              dir="ltr"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              aria-invalid={Boolean(fieldErrors.password)}
              disabled={isPending || disabled}
              required
            />
          </Field>
        </CardBody>

        <CardFooter className="flex-col items-stretch gap-3">
          <Button type="submit" size="lg" disabled={isPending || disabled} className="w-full">
            {isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <LogIn className="size-4" aria-hidden />}
            {disabled ? "ابتدا پایگاه داده را بسازید" : isPending ? "در حال ورود…" : "ورود"}
          </Button>

          <p className="text-center text-sm text-slate-500">
            حساب کاربری ندارید؟{" "}
            <Link href="/register" className="font-medium text-slate-900 underline underline-offset-4">
              ثبت‌نام کنید
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
