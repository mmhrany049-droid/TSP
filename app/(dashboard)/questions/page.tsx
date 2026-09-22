import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { DatabaseNotice } from "@/components/db-notice";
import { QuestionBank } from "@/components/questions/question-bank";
import { EmptyState } from "@/components/ui/empty-state";
import { auth } from "@/lib/auth";
import { LOGIN_PATH } from "@/lib/auth.config";
import { getDatabaseStatus } from "@/lib/db-status";
import { listBookOptionsForForms } from "@/lib/services/books";
import { getQuestionBankSummary, listQuestions } from "@/lib/services/questions";

export const metadata: Metadata = { title: "بانک تست" };

export const dynamic = "force-dynamic";

/** خواندن یک مقدار تک‌رشته‌ای از `searchParams` (Next می‌تواند آرایه هم بدهد). */
function readParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

/**
 * صفحهٔ بانک تست — ماژول `QuestionBank`.
 *
 * فیلترهای اولیه از آدرس صفحه خوانده می‌شوند تا لینک‌هایی مثل
 * `‎/questions?bookId=…` از صفحهٔ کتاب هم درست کار کنند.
 */
export default async function QuestionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
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
          title="پس از آماده شدن پایگاه داده، بانک تست اینجا نمایش داده می‌شود"
          description="دستور `npm run db:setup` جدول‌ها را می‌سازد و این صفحه بدون راه‌اندازی دوباره درست می‌شود."
        />
      </div>
    );
  }

  const params = await searchParams;
  const bookId = readParam(params.bookId);
  const bookNodeId = readParam(params.bookNodeId);

  const [books, list, summary] = await Promise.all([
    listBookOptionsForForms(session.user.id),
    listQuestions(session.user.id, { bookId: bookId || undefined, bookNodeId: bookNodeId || undefined }),
    getQuestionBankSummary(session.user.id),
  ]);

  return (
    <QuestionBank
      books={books}
      initialList={list}
      initialSummary={summary}
      initialFilters={{ bookId, bookNodeId }}
    />
  );
}
