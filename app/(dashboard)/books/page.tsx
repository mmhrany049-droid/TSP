import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { DatabaseNotice } from "@/components/db-notice";
import { LibraryView } from "@/components/library/library-view";
import { EmptyState } from "@/components/ui/empty-state";
import { auth } from "@/lib/auth";
import { LOGIN_PATH } from "@/lib/auth.config";
import { getDatabaseStatus } from "@/lib/db-status";
import { getLibrarySummary, listBooks } from "@/lib/services/books";

export const metadata: Metadata = { title: "کتاب‌ها و ساختار" };

// داده‌ها همیشه تازه خوانده می‌شوند (نه از کش استاتیک).
export const dynamic = "force-dynamic";

/**
 * صفحهٔ کتاب‌ها — ماژول `LibraryManager`.
 *
 * دادهٔ اولیه در سرور و با همان لایهٔ سرویس خوانده می‌شود؛ تغییرها از سمت مرورگر
 * به `/api/books` می‌روند و بعد صفحه دوباره تازه‌سازی می‌شود.
 */
export default async function BooksPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect(LOGIN_PATH);
  }

  const database = await getDatabaseStatus();

  if (database.state !== "ready") {
    return (
      <div className="space-y-6">
        <DatabaseNotice />
        <EmptyState
          title="پس از آماده شدن پایگاه داده، کتاب‌ها اینجا نمایش داده می‌شوند"
          description="با دستور `npm run db:setup` جدول‌ها ساخته می‌شوند و این صفحه بدون راه‌اندازی دوباره درست می‌شود."
        />
      </div>
    );
  }

  const [books, summary] = await Promise.all([listBooks(session.user.id), getLibrarySummary(session.user.id)]);

  return <LibraryView books={books} summary={summary} />;
}
