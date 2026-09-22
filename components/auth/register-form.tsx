"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Loader2, UserPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardBody, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FormAlert } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { registerSchema, zodFieldErrors } from "@/lib/validations";
import type { ApiResult } from "@/types";

/**
 * فرم ثبت‌نام.
 *
 * ابتدا حساب با `POST /api/auth/register` ساخته می‌شود (که خودش ورودی را دوباره
 * اعتبارسنجی و گذرواژه را هش می‌کند)، سپس کاربر بی‌درنگ وارد برنامه می‌شود تا
 * یک قدم اضافه برای ورود دوباره نداشته باشد.
 */
export function RegisterForm({
  disabled = false,
  disabledReason,
}: {
  /** وقتی پایگاه داده آماده نیست، فرم غیرفعال می‌شود تا خطای مبهم نگیریم. */
  disabled?: boolean;
  /** توضیح فارسی دلیل غیرفعال بودن فرم. */
  disabledReason?: string;
} = {}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
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

    const parsed = registerSchema.safeParse({ name, email, password, confirmPassword });

    if (!parsed.success) {
      setFieldErrors(zodFieldErrors(parsed.error));
      return;
    }

    setIsPending(true);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });

      const result = (await response.json()) as ApiResult<{ user: { id: string } }>;

      if (!result.ok) {
        setFieldErrors(result.fieldErrors ?? {});
        setFormError(result.error);
        return;
      }

      const signInResult = await signIn("credentials", {
        email: parsed.data.email,
        password: parsed.data.password,
        redirect: false,
      });

      if (signInResult?.error || !signInResult?.url) {
        // حساب ساخته شده است؛ فقط ورود خودکار نگرفت.
        router.replace("/login");
        return;
      }

      router.replace("/");
      router.refresh();
    } catch {
      setFormError("ارتباط با سرور برقرار نشد؛ لطفاً دوباره تلاش کنید.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>ساخت حساب کاربری</CardTitle>
        <span className="text-xs text-slate-400">یک بار برای همیشه</span>
      </CardHeader>

      <form onSubmit={handleSubmit} noValidate>
        <CardBody className="space-y-4">
          {formError ? <FormAlert>{formError}</FormAlert> : null}

          <Field id="name" label="نام و نام خانوادگی" required error={fieldErrors.name}>
            <Input
              id="name"
              name="name"
              autoComplete="name"
              placeholder="مثلاً: محمد حسین‌زاده"
              value={name}
              onChange={(event) => setName(event.target.value)}
              aria-invalid={Boolean(fieldErrors.name)}
              disabled={isPending || disabled}
              required
            />
          </Field>

          <Field id="email" label="ایمیل" required error={fieldErrors.email} hint="ایمیل نام کاربری شماست.">
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

          <Field
            id="password"
            label="گذرواژه"
            required
            error={fieldErrors.password}
            hint="حداقل ۸ نویسه."
          >
            <Input
              id="password"
              name="password"
              type="password"
              dir="ltr"
              autoComplete="new-password"
              placeholder="••••••••"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              aria-invalid={Boolean(fieldErrors.password)}
              disabled={isPending || disabled}
              required
            />
          </Field>

          <Field id="confirmPassword" label="تکرار گذرواژه" required error={fieldErrors.confirmPassword}>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              dir="ltr"
              autoComplete="new-password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              aria-invalid={Boolean(fieldErrors.confirmPassword)}
              disabled={isPending || disabled}
              required
            />
          </Field>
        </CardBody>

        <CardFooter className="flex-col items-stretch gap-3">
          <Button type="submit" size="lg" disabled={isPending || disabled} className="w-full">
            {isPending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <UserPlus className="size-4" aria-hidden />
            )}
            {disabled ? "ابتدا پایگاه داده را بسازید" : isPending ? "در حال ساخت حساب…" : "ساخت حساب و ورود"}
          </Button>

          <p className="text-center text-sm text-slate-500">
            حساب دارید؟{" "}
            <Link href="/login" className="font-medium text-slate-900 underline underline-offset-4">
              وارد شوید
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
