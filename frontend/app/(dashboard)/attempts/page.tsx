"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Alert, Button, EmptyState, PageHeader, ResultBadge, SelectInput, Spinner } from "@/components/ui";
import { api } from "@/lib/api";
import { errorMessage, formatCount, formatJalali, formatSeconds } from "@/lib/format";
import { RESULT_LABELS, SOURCE_LABELS } from "@/lib/labels";
import type { Attempt, Book, Page, Result } from "@/types";

export default function AttemptsPage() {
  const [items, setItems] = useState<Attempt[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [result, setResult] = useState<"" | Result>("");
  const [bookId, setBookId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = "تاریخچه تلاش‌ها | TSP";
    api<Page<Book>>("/books?size=100")
      .then((data) => setBooks(data.items))
      .catch(() => setBooks([]));
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), size: "20" });
    if (result) params.set("result", result);
    if (bookId) params.set("book_id", bookId);
    api<Page<Attempt>>(`/attempts?${params.toString()}`)
      .then((data) => {
        setItems(data.items);
        setPages(data.pages);
        setTotal(data.total);
        setError(null);
      })
      .catch((err: unknown) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, [page, result, bookId]);

  return (
    <div>
      <PageHeader
        eyebrow="سابقه"
        title="تاریخچه تلاش‌ها"
        description="هر بار حل، یک ردیف جداست. این فهرست هرگز با تلاش جدید جایگزین نمی‌شود."
      />
      <div className="mb-4 flex flex-wrap gap-3">
        <SelectInput
          className="max-w-48"
          value={result}
          onChange={(event) => {
            setPage(1);
            setResult(event.target.value as "" | Result);
          }}
        >
          <option value="">همه نتیجه‌ها</option>
          {Object.entries(RESULT_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </SelectInput>
        <SelectInput
          className="max-w-64"
          value={bookId}
          onChange={(event) => {
            setPage(1);
            setBookId(event.target.value);
          }}
        >
          <option value="">همه کتاب‌ها</option>
          {books.map((book) => <option key={book.id} value={book.id}>{book.title}</option>)}
        </SelectInput>
        <p className="self-center text-sm text-muted">{formatCount(total)} رکورد</p>
      </div>
      {error ? <Alert>{error}</Alert> : null}
      {loading ? <Spinner /> : null}
      {!loading && items.length === 0 ? (
        <EmptyState title="تلاشی ثبت نشده" body="از صفحه یک تست، پاسخ را وارد کنید تا اولین رکورد تاریخچه ساخته شود." />
      ) : null}
      {!loading && items.length > 0 ? (
        <div className="panel overflow-x-auto">
          <table className="w-full min-w-[52rem] text-sm">
            <thead className="text-xs text-muted">
              <tr className="border-b border-line">
                <th className="px-4 py-3 text-right font-medium">تست</th>
                <th className="px-4 py-3 text-right font-medium">کتاب</th>
                <th className="px-4 py-3 text-right font-medium">پاسخ</th>
                <th className="px-4 py-3 text-right font-medium">نتیجه</th>
                <th className="px-4 py-3 text-right font-medium">زمان</th>
                <th className="px-4 py-3 text-right font-medium">تاریخ</th>
                <th className="px-4 py-3 text-right font-medium">منبع</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-line/70">
                  <td className="px-4 py-3">
                    <Link href={`/questions/${item.question_id}`} className="font-bold hover:text-pine">
                      {item.display_number} {item.attempt_index ? `· تلاش ${formatCount(item.attempt_index)}` : ""}
                    </Link>
                    <p className="text-xs text-muted">{item.node_title}</p>
                  </td>
                  <td className="px-4 py-3">{item.book_title}</td>
                  <td className="px-4 py-3">{item.user_answer || "—"}</td>
                  <td className="px-4 py-3"><ResultBadge result={item.result} /></td>
                  <td className="px-4 py-3">{formatSeconds(item.spent_seconds)}</td>
                  <td className="px-4 py-3">{formatJalali(item.attempted_at)}</td>
                  <td className="px-4 py-3">{SOURCE_LABELS[item.source]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {pages > 1 ? (
        <div className="mt-4 flex items-center gap-2">
          <Button type="button" variant="secondary" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>قبلی</Button>
          <span className="text-sm text-muted">صفحه {formatCount(page)} از {formatCount(pages)}</span>
          <Button type="button" variant="secondary" disabled={page >= pages} onClick={() => setPage((value) => value + 1)}>بعدی</Button>
        </div>
      ) : null}
    </div>
  );
}
