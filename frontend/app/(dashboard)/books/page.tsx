"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Alert, EmptyState, PageHeader, Spinner } from "@/components/ui";
import { api } from "@/lib/api";
import { errorMessage, formatCount, formatPercent } from "@/lib/format";
import type { Book, Page } from "@/types";

export default function BooksPage() {
  const [books, setBooks] = useState<Book[]>([]);
  const [query, setQuery] = useState("");
  const [includeArchived, setIncludeArchived] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = "کتاب‌ها | TSP";
  }, []);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setLoading(true);
      const params = new URLSearchParams({ page: "1", size: "50" });
      if (query.trim()) params.set("q", query.trim());
      if (includeArchived) params.set("include_archived", "true");
      api<Page<Book>>(`/books?${params.toString()}`)
        .then((page) => {
          setBooks(page.items);
          setError(null);
        })
        .catch((err: unknown) => setError(errorMessage(err)))
        .finally(() => setLoading(false));
    }, 200);
    return () => window.clearTimeout(handle);
  }, [query, includeArchived]);

  return (
    <div>
      <PageHeader
        eyebrow="کتابخانه"
        title="کتاب‌های تست"
        description="هر کتاب ساختار خودش را دارد. فصل، بخش، تست مخلوط و آزمون چکاپ را جداگانه تعریف کنید."
        action={
          <Link href="/books/new" className="inline-flex h-11 items-center rounded-xl bg-pine px-4 text-sm font-semibold text-white">
            کتاب جدید
          </Link>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="جستجو در عنوان، درس یا ناشر"
          className="h-11 w-full max-w-sm rounded-xl border border-line bg-white px-3 outline-none focus:border-pine"
        />
        <label className="flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" checked={includeArchived} onChange={(event) => setIncludeArchived(event.target.checked)} />
          نمایش آرشیو
        </label>
      </div>
      {error ? <Alert>{error}</Alert> : null}
      {loading ? <Spinner /> : null}
      {!loading && books.length === 0 ? (
        <EmptyState
          title="کتابی پیدا نشد"
          body="یک کتاب مثل شیمی ۲ مبتکران بسازید، بعد فصل و تست را به آن اضافه کنید."
          action={
            <Link href="/books/new" className="inline-flex h-11 items-center rounded-xl bg-pine px-4 text-sm font-semibold text-white">
              ساخت اولین کتاب
            </Link>
          }
        />
      ) : null}
      <div className="grid gap-3 md:grid-cols-2">
        {books.map((book) => (
          <Link key={book.id} href={`/books/${book.id}`} className="panel block p-5 transition hover:-translate-y-0.5 hover:border-pine/40">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-pine">{book.subject}</p>
                <h2 className="mt-1 text-xl font-extrabold">{book.title}</h2>
              </div>
              {!book.is_active ? <span className="rounded-full bg-[#efe8dc] px-2 py-1 text-xs">آرشیو</span> : null}
            </div>
            <p className="mt-2 text-sm text-muted">
              {[book.publisher, book.grade, book.field].filter(Boolean).join(" · ") || "بدون مشخصات بیشتر"}
            </p>
            <div className="mt-4 flex items-end justify-between text-sm">
              <span>{formatCount(book.question_count)} تست · {formatCount(book.attempt_count)} تلاش</span>
              <span className="text-lg font-extrabold tabular-nums">{formatPercent(book.percentage)}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
