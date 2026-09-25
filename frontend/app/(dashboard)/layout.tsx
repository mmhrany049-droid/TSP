"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/components/AuthProvider";
import { Spinner } from "@/components/ui";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (auth.ready && !auth.user) router.replace("/login");
  }, [auth.ready, auth.user, router]);

  if (!auth.ready || !auth.user) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Spinner label="در حال بررسی نشست..." />
      </div>
    );
  }

  return <AppShell>{children}</AppShell>;
}
