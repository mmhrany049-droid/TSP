"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { Alert, Button, Field, TextInput } from "@/components/ui";
import { errorMessage } from "@/lib/format";

export default function RegisterPage() {
  const auth = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    document.title = "ثبت‌نام | TSP";
    if (auth.ready && auth.user) router.replace("/");
  }, [auth.ready, auth.user, router]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!email.includes("@")) {
      setError("ایمیل معتبر وارد کنید.");
      return;
    }
    if (password.length < 8) {
      setError("رمز عبور باید حداقل ۸ کاراکتر باشد.");
      return;
    }
    if (password !== repeat) {
      setError("تکرار رمز عبور یکسان نیست.");
      return;
    }
    setPending(true);
    try {
      await auth.register({ email: email.trim(), password, name: name.trim() });
      router.replace("/");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="w-full max-w-md">
      <p className="text-sm font-bold text-pine lg:hidden">TSP</p>
      <h2 className="mt-2 text-3xl font-extrabold">ثبت‌نام</h2>
      <p className="mt-2 text-sm leading-7 text-muted">یک حساب شخصی برای کتاب‌ها و سابقه حل تست.</p>
      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        {error ? <Alert>{error}</Alert> : null}
        <Field label="نام" hint="اختیاری">
          <TextInput value={name} onChange={(event) => setName(event.target.value)} placeholder="مثلاً نگار" />
        </Field>
        <Field label="ایمیل">
          <TextInput
            type="email"
            dir="ltr"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="name@example.com"
            className="text-left"
          />
        </Field>
        <Field label="رمز عبور" hint="حداقل ۸ کاراکتر">
          <TextInput
            type="password"
            dir="ltr"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="text-left"
          />
        </Field>
        <Field label="تکرار رمز عبور">
          <TextInput
            type="password"
            dir="ltr"
            autoComplete="new-password"
            value={repeat}
            onChange={(event) => setRepeat(event.target.value)}
            className="text-left"
          />
        </Field>
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "در حال ساخت حساب..." : "ساخت حساب و ورود"}
        </Button>
      </form>
      <p className="mt-6 text-sm text-muted">
        قبلاً ثبت‌نام کرده‌اید؟ <Link href="/login" className="font-bold text-pine">ورود</Link>
      </p>
    </div>
  );
}
