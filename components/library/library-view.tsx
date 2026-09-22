"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookPlus, Library, Pencil, Plus, Star, Trash2, TriangleAlert, Zap } from "lucide-react";
import type { Book } from "@prisma/client";

import { apiRequest } from "@/lib/api-client";
import { formatNumber } from "@/lib/format";
import type { BookWithCounts, LibrarySummary } from "@/lib/services/books";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle, StatCard } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { FormAlert } from "@/components/ui/field";
import { BookForm } from "@/components/library/book-form";

/**
 * صفحهٔ «کتاب‌ها و ساختار».
 *
 * دادهٔ اولیه از سرور می‌آید (سریع و بدون پرش) و پس از هر تغییر، با
 * `router.refresh()` دوباره از سرور خوانده می‌شود تا آمار همیشه دقیق بماند.
 */
export function LibraryView({ books, summary }: { books: BookWithCounts[]; summary: LibrarySummary }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Book | null>(null);
  const [deleting, setDeleting] = useState<BookWithCounts | null>(null);
  const [error, setError] = useState<string | null>(null);

  function refresh() {
    startTransition(() => router.refresh());
  }

  async function confirmDelete() {
    if (!deleting) {
      return;
    }

    const result = await apiRequest(`/api/books/${deleting.id}`, { method: "DELETE" });

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setDeleting(null);
    refresh();
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <h1 className="flex items-center gap-2 text-xl font-semibold text-slate-900">
            <Library className="size-5 text-slate-400" aria-hidden />
            کتاب‌ها و ساختار
          </h1>
          <p className="text-sm text-slate-500">
            هر کتاب را با فصل‌ها و بخش‌هایش بساز؛ تست‌ها بعداً داخل همین ساختار ثبت می‌شوند.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/questions"
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-800 hover:bg-slate-50"
          >
            رفتن به بانک تست
          </Link>
          <Button onClick={() => setCreating(true)}>
            <Plus className="size-4" aria-hidden />
            کتاب تازه
          </Button>
        </div>
      </header>

      {error ? <FormAlert>{error}</FormAlert> : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="کتاب‌ها" value={formatNumber(summary.bookCount)} />
        <StatCard label="فصل و بخش" value={formatNumber(summary.nodeCount)} />
        <StatCard
          label="تست‌ها"
          value={formatNumber(summary.questionCount)}
          hint={summary.bySubject.length > 0 ? `${formatNumber(summary.bySubject.length)} درس` : undefined}
        />
        <StatCard
          label="علامت‌ها"
          value={
            <span className="flex items-center gap-3 text-xl">
              <span className="flex items-center gap-1 text-amber-600">
                <Star className="size-4" aria-hidden />
                {formatNumber(summary.importantCount)}
              </span>
              <span className="flex items-center gap-1 text-rose-600">
                <Zap className="size-4" aria-hidden />
                {formatNumber(summary.hardCount)}
              </span>
            </span>
          }
          hint="مهم / سخت"
        />
      </div>

      {books.length === 0 ? (
        <EmptyState
          icon={<BookPlus className="size-8" aria-hidden />}
          title="هنوز کتابی ثبت نشده است"
          description="برای شروع، یک کتاب بساز و بعد فصل‌ها و بخش‌هایش را اضافه کن. تست‌ها به همین ساختار وصل می‌شوند."
          action={
            <Button onClick={() => setCreating(true)}>
              <Plus className="size-4" aria-hidden />
              ساخت اولین کتاب
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {books.map((book) => (
            <Card key={book.id} className={isPending ? "opacity-80 transition-opacity" : undefined}>
              <CardHeader>
                <div className="min-w-0 space-y-1">
                  <CardTitle className="truncate">{book.title}</CardTitle>
                  <p className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <Badge tone="info">{book.subject}</Badge>
                    {book.publisher ? <span>{book.publisher}</span> : null}
                    {book.grade ? <span>• {book.grade}</span> : null}
                    {book.field ? <span>• {book.field}</span> : null}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <Button variant="ghost" size="icon" aria-label="ویرایش کتاب" onClick={() => setEditing(book)}>
                    <Pencil className="size-4" aria-hidden />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="حذف کتاب"
                    className="text-rose-600 hover:bg-rose-50"
                    onClick={() => setDeleting(book)}
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </Button>
                </div>
              </CardHeader>

              <CardBody className="space-y-4">
                {book.notes ? <p className="text-sm text-slate-600">{book.notes}</p> : null}

                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-xl bg-slate-50 px-3 py-2">
                    <dt className="text-xs text-slate-500">فصل و بخش</dt>
                    <dd className="mt-1 font-medium text-slate-900">{formatNumber(book._count.nodes)}</dd>
                  </div>
                  <div className="rounded-xl bg-slate-50 px-3 py-2">
                    <dt className="text-xs text-slate-500">تست‌ها</dt>
                    <dd className="mt-1 font-medium text-slate-900">{formatNumber(book._count.questions)}</dd>
                  </div>
                </dl>

                <Link
                  href={`/books/${book.id}`}
                  className="inline-flex h-10 w-full items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800"
                >
                  ساختار و مدیریت کتاب
                </Link>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={creating} title="کتاب تازه" description="ویژگی‌های کتاب را وارد کن؛ ساختار فصل‌ها بعد از ساخت اضافه می‌شود." onClose={() => setCreating(false)}>
        <BookForm
          onCancel={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            refresh();
          }}
        />
      </Dialog>

      <Dialog open={editing !== null} title="ویرایش کتاب" onClose={() => setEditing(null)}>
        {editing ? (
          <BookForm
            book={editing}
            onCancel={() => setEditing(null)}
            onSaved={() => {
              setEditing(null);
              refresh();
            }}
          />
        ) : null}
      </Dialog>

      <Dialog
        open={deleting !== null}
        title="حذف کتاب"
        description="این کار قابل بازگشت نیست."
        onClose={() => setDeleting(null)}
      >
        {deleting ? (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
              <TriangleAlert className="mt-0.5 size-5 shrink-0" aria-hidden />
              <p>
                کتاب <strong>{deleting.title}</strong> با {formatNumber(deleting._count.nodes)} گرهٔ ساختار و{" "}
                {formatNumber(deleting._count.questions)} تست حذف می‌شود.
                {deleting._count.questions > 0 ? " همهٔ تلاش‌های ثبت‌شده برای این تست‌ها هم پاک می‌شوند." : ""}
              </p>
            </div>

            <div className="flex items-center justify-end gap-2">
              <Button variant="ghost" onClick={() => setDeleting(null)}>
                انصراف
              </Button>
              <Button variant="danger" onClick={confirmDelete}>
                بله، حذف کن
              </Button>
            </div>
          </div>
        ) : null}
      </Dialog>
    </div>
  );
}
