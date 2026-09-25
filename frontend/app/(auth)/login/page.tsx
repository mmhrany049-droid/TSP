"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { Alert, Button, Field, TextInput } from "@/components/ui";
import { errorMessage } from "@/lib/format";

export default function LoginPage() {
  const auth = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    document.title = "ورود | TSP";
    if (auth.ready && auth.user) router.replace("/");
  }, [auth.ready, auth.user, router]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError("ایمیل و رمز عبور را وارد کنید.");
      return;
    }
    setPending(true);
    try {
      await auth.login(email.trim(), password);
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
      <h2 className="mt-2 text-3xl font-extrabold">ورود</h2>
      <p className="mt-2 text-sm leading-7 text-muted">به دفتر تست خود برگردید.</p>
      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        {error ? <Alert>{error}</Alert> : null}
        <Field label="ایمیل">
          <TextInput
            type="email"
            dir="ltr"
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="name@example.com"
            className="text-left"
          />
        </Field>
        <Field label="رمز عبور">
          <TextInput
            type="password"
            dir="ltr"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="text-left"
          />
        </Field>
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "در حال ورود..." : "ورود"}
        </Button>
      </form>
      <p className="mt-6 text-sm text-muted">
        حساب ندارید؟ <Link href="/register" className="font-bold text-pine">ثبت‌نام</Link>
      </p>
    </div>
  );
}
