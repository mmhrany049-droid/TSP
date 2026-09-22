"use client";

import { useState } from "react";
import { Loader2, LogOut } from "lucide-react";
import { signOut } from "next-auth/react";

import { Button } from "@/components/ui/button";

/**
 * بخش کاربر در نوار بالایی: نام، ایمیل و دکمهٔ خروج.
 *
 * خروج با `signOut` انجام می‌شود که کوکی نشست را پاک می‌کند و کاربر را به صفحهٔ
 * ورود می‌فرستد.
 */
export function UserMenu({ name, email }: { name: string; email: string }) {
  const [isPending, setIsPending] = useState(false);
  const initial = Array.from(name.trim())[0] ?? "؟";

  async function handleSignOut() {
    setIsPending(true);

    try {
      await signOut({ redirectTo: "/login" });
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="flex items-center gap-2 sm:gap-3">
      <div className="hidden min-w-0 text-right sm:block">
        <p className="truncate text-sm font-medium text-slate-800">{name}</p>
        <p className="truncate text-xs text-slate-400" dir="ltr">
          {email}
        </p>
      </div>

      <span
        aria-hidden
        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sm font-semibold text-sky-700"
      >
        {initial}
      </span>

      <Button
        variant="outline"
        size="sm"
        onClick={handleSignOut}
        disabled={isPending}
        title="خروج از حساب"
        aria-label="خروج از حساب"
      >
        {isPending ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : (
          <LogOut className="size-4" aria-hidden />
        )}
        <span className="hidden sm:inline">خروج</span>
      </Button>
    </div>
  );
}
