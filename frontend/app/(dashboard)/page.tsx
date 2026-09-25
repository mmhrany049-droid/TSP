"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { Alert, EmptyState, PageHeader, PercentBar, ResultBadge, Spinner } from "@/components/ui";
import { api } from "@/lib/api";
import { errorMessage, formatCount, formatJalali, formatPercent } from "@/lib/format";
import { PERCENT_NOTE, SOURCE_LABELS } from "@/lib/labels";
import type { DashboardSummary } from "@/types";

export default function DashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = "داشبورد | TSP";
    api<DashboardSummary>("/dashboard/summary")
      .then(setData)
      .catch((err: unknown) => setError(errorMessage(err)));
  }, []);

  if (error) return <Alert>{error}</Alert>;
  if (!data) return <Spinner />;

  const steps = [
    { done: true, label: "ثبت‌نام", href: "/" },
    { done: data.checklist.has_book, label: "ساخت کتاب", href: "/books/new" },
    {
      done: data.checklist.has_chapter,
      label: "افزودن فصل",
      href: data.continue_book_id ? `/books/${data.continue_book_id}` : "/books/new",
    },
    {
      done: data.checklist.has_question,
      label: "افزودن تست",
      href: data.continue_book_id ? `/books/${data.continue_book_id}` : "/books",
    },
    {
      done: data.checklist.has_attempt,
      label: "حل تست",
      href: data.continue_question_id
        ? `/questions/${data.continue_question_id}`
        : data.continue_book_id
          ? `/books/${data.continue_book_id}`
          : "/books",
    },
  ];
  const started = steps.some((step) => !step.done);

  return (
    <div>
      <PageHeader
        eyebrow="دفتر مطالعه"
        title={`سلام${user?.name ? `، ${user.name}` : ""}`}
        description="درصدها از روی تلاش‌های خام محاسبه می‌شوند و هیچ تلاشی جایگزین قبلی نمی‌شود."
        action={
          <Link href="/books/new" className="inline-flex h-11 items-center rounded-xl bg-pine px-4 text-sm font-semibold text-white">
            کتاب جدید
          </Link>
        }
      />

      {started ? (
        <section className="panel mb-6 p-4 sm:p-5">
          <p className="text-sm font-bold">مسیر شروع</p>
          <ol className="mt-4 grid gap-2 sm:grid-cols-5">
            {steps.map((step, index) => (
              <li key={step.label}>
                <Link
                  href={step.href}
                  className="flex h-full items-center gap-2 rounded-xl border border-line bg-white px-3 py-3 text-sm hover:border-pine"
                >
                  <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold ${step.done ? "bg-pine text-white" : "bg-foam text-pine"}`}>
                    {formatCount(index + 1)}
                  </span>
                  <span>
                    <span className="block font-semibold">{step.label}</span>
                    <span className="text-xs text-muted">{step.done ? "انجام شد" : "مرحله بعد"}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="کتاب فعال" value={formatCount(data.books_count)} />
        <Stat label="تست فعال" value={formatCount(data.questions_count)} />
        <Stat label="تلاش ثبت‌شده" value={formatCount(data.attempts.total)} />
        <Stat label="درصد کل" value={formatPercent(data.attempts.percentage)} hint={`${formatCount(data.attempts.correct)} درست از ${formatCount(data.attempts.total)}`} />
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="panel p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-extrabold">آخرین تلاش‌ها</h2>
            <Link href="/attempts" className="text-sm font-semibold text-pine">همه</Link>
          </div>
          {data.recent_attempts.length === 0 ? (
            <EmptyState title="هنوز تلاشی نیست" body="بعد از افزودن تست، آن را حل کنید تا نتیجه و درصد اینجا بیاید." />
          ) : (
            <ul className="divide-y divide-line">
              {data.recent_attempts.map((attempt) => (
                <li key={attempt.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <Link href={`/questions/${attempt.question_id}`} className="font-bold hover:text-pine">
                      تست {attempt.display_number}
                    </Link>
                    <p className="truncate text-xs text-muted">
                      {attempt.book_title} · {formatJalali(attempt.attempted_at)} · {SOURCE_LABELS[attempt.source]}
                    </p>
                  </div>
                  <ResultBadge result={attempt.result} />
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="panel p-5">
          <h2 className="text-lg font-extrabold">درصد کتاب‌ها</h2>
          <p className="mt-1 text-xs leading-6 text-muted">{PERCENT_NOTE}</p>
          <div className="mt-4 space-y-4">
            {data.books.length === 0 ? (
              <EmptyState title="کتابی نیست" body="اولین کتاب تست را بسازید." action={<Link href="/books/new" className="text-sm font-bold text-pine">ساخت کتاب</Link>} />
            ) : (
              data.books.map((book) => (
                <Link key={book.id} href={`/books/${book.id}`} className="block rounded-xl border border-transparent px-1 py-1 hover:border-line">
                  <PercentBar
                    label={book.title}
                    value={book.percentage}
                    detail={`${book.subject} · ${formatCount(book.question_count)} تست · ${formatCount(book.attempt_count)} تلاش`}
                  />
                </Link>
              ))
            )}
          </div>
          <div className="mt-5 grid grid-cols-2 gap-2 text-sm">
            <Mini label="مهم" value={data.important_count} />
            <Mini label="سخت" value={data.hard_count} />
          </div>
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="panel px-4 py-4">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-2xl font-extrabold tabular-nums">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

function Mini({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-foam px-3 py-2">
      <span className="text-muted">{label}</span>
      <span className="ms-2 font-bold">{formatCount(value)}</span>
    </div>
  );
}
