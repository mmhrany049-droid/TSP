"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Archive,
  ArchiveRestore,
  Filter,
  ListChecks,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Star,
  Trash2,
  TriangleAlert,
  Zap,
} from "lucide-react";
import type { Question } from "@prisma/client";

import { apiRequest } from "@/lib/api-client";
import { BOOK_NODE_TYPE_LABELS, PUBLISHER_DIFFICULTIES } from "@/lib/constants";
import { formatNumber, toPersianDigits } from "@/lib/format";
import type { PaginatedQuestions, QuestionWithContext } from "@/lib/services/questions";
import { buildTree, toSelectOptions } from "@/lib/tree";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle, StatCard } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { FormAlert } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { QuestionForm, type BookOption } from "@/components/questions/question-form";

/** آمار خلاصهٔ بانک تست. */
export interface BankSummary {
  total: number;
  important: number;
  hard: number;
  publisherHard: number;
  archived: number;
  withAttempts: number;
}

/** وضعیت فیلترهای صفحه. */
interface FilterState {
  bookId: string;
  bookNodeId: string;
  important: boolean;
  hard: boolean;
  inactive: boolean;
  publisherDifficulty: string;
  search: string;
}

const EMPTY_FILTERS: FilterState = {
  bookId: "",
  bookNodeId: "",
  important: false,
  hard: false,
  inactive: false,
  publisherDifficulty: "",
  search: "",
};

/** ساخت آدرس API از فیلترها و شمارهٔ صفحه. */
function buildQuery(filters: FilterState, page: number): string {
  const params = new URLSearchParams();

  if (filters.bookId) params.set("bookId", filters.bookId);
  if (filters.bookNodeId) params.set("bookNodeId", filters.bookNodeId);
  if (filters.important) params.set("important", "true");
  if (filters.hard) params.set("hard", "true");
  if (filters.inactive) params.set("inactive", "true");
  if (filters.publisherDifficulty) params.set("publisherDifficulty", filters.publisherDifficulty);
  if (filters.search.trim()) params.set("search", filters.search.trim());
  params.set("page", String(page));

  return params.toString();
}

/**
 * بانک تست: فهرست، فیلتر، ثبت و ویرایش تست‌ها.
 *
 * دادهٔ صفحهٔ اول از سرور می‌آید و تغییر فیلترها با فراخوانی
 * `/api/questions` انجام می‌شود؛ همین مسیر فیلترها را در آدرس صفحه هم
 * قابل اشتراک می‌کند.
 */
export function QuestionBank({
  books,
  initialList,
  initialSummary,
  initialFilters,
}: {
  books: BookOption[];
  initialList: PaginatedQuestions;
  initialSummary: BankSummary;
  initialFilters: Partial<FilterState>;
}) {
  const router = useRouter();
  const [filters, setFilters] = useState<FilterState>({ ...EMPTY_FILTERS, ...initialFilters });
  const [list, setList] = useState<PaginatedQuestions>(initialList);
  const [summary, setSummary] = useState<BankSummary>(initialSummary);
  const [page, setPage] = useState(initialList.page);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<QuestionWithContext | null>(null);
  const [deleting, setDeleting] = useState<QuestionWithContext | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [isFirstRender, setIsFirstRender] = useState(true);

  /** دریافت فهرست تازه از سرور. */
  const load = useCallback(
    async (nextFilters: FilterState, nextPage: number) => {
      setLoading(true);
      setError(null);

      const result = await apiRequest<PaginatedQuestions & { summary: BankSummary }>(
        `/api/questions?${buildQuery(nextFilters, nextPage)}`,
      );

      setLoading(false);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      const { summary: freshSummary, ...freshList } = result.data;

      setList(freshList);
      setSummary(freshSummary);
      setPage(freshList.page);
    },
    [],
  );

  // با هر تغییر فیلتر یا صفحه، فهرست دوباره خوانده می‌شود (بار اول از دادهٔ سرور).
  useEffect(() => {
    if (isFirstRender) {
      setIsFirstRender(false);
      return;
    }

    void load(filters, page);
  }, [filters, page, isFirstRender, load]);

  /** گزینه‌های «محل تست» بر اساس کتاب انتخاب‌شده در فیلتر. */
  const nodeOptions = useMemo(() => {
    const book = books.find((item) => item.id === filters.bookId);

    return book ? toSelectOptions(buildTree(book.nodes)) : [];
  }, [books, filters.bookId]);

  const hasActiveFilter =
    filters.bookId !== "" ||
    filters.bookNodeId !== "" ||
    filters.important ||
    filters.hard ||
    filters.inactive ||
    filters.publisherDifficulty !== "" ||
    filters.search.trim() !== "";

  function updateFilters(patch: Partial<FilterState>) {
    setPage(1);
    setFilters((current) => ({ ...current, ...patch }));
  }

  /** تغییر یک علامت از داخل فهرست، بدون بستن صفحه. */
  async function toggleFlag(question: QuestionWithContext, flag: "isImportant" | "isHard") {
    setBusyId(question.id);

    const result = await apiRequest<Question>(`/api/questions/${question.id}`, {
      method: "PATCH",
      body: { [flag]: !question[flag] },
    });

    setBusyId(null);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setList((current) => ({
      ...current,
      items: current.items.map((item) =>
        item.id === question.id ? { ...item, [flag]: result.data[flag] } : item,
      ),
    }));

    // آمار بالای صفحه هم به‌روز می‌شود.
    setSummary((current) => ({
      ...current,
      important: flag === "isImportant" ? current.important + (result.data.isImportant ? 1 : -1) : current.important,
      hard: flag === "isHard" ? current.hard + (result.data.isHard ? 1 : -1) : current.hard,
    }));
  }

  /** بایگانی یا بازگردانی تست. */
  async function toggleArchive(question: QuestionWithContext) {
    setBusyId(question.id);

    const result = await apiRequest<Question>(`/api/questions/${question.id}`, {
      method: "PATCH",
      body: { isActive: !question.isActive },
    });

    setBusyId(null);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setSummary((current) => ({
      ...current,
      total: current.total + (result.data.isActive ? 1 : -1),
      archived: current.archived + (result.data.isActive ? -1 : 1),
    }));

    // اگر تست از فیلتر فعلی بیرون می‌رود، از فهرست حذفش می‌کنیم.
    if (!result.data.isActive && !filters.inactive) {
      setList((current) => ({
        ...current,
        items: current.items.filter((item) => item.id !== question.id),
        total: Math.max(current.total - 1, 0),
      }));
      return;
    }

    setList((current) => ({
      ...current,
      items: current.items.map((item) =>
        item.id === question.id ? { ...item, isActive: result.data.isActive } : item,
      ),
    }));
  }

  async function confirmDelete() {
    if (!deleting) {
      return;
    }

    const result = await apiRequest(`/api/questions/${deleting.id}`, { method: "DELETE" });

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setDeleting(null);
    setList((current) => ({
      ...current,
      items: current.items.filter((item) => item.id !== deleting.id),
      total: Math.max(current.total - 1, 0),
    }));
    setSummary((current) => ({ ...current, total: Math.max(current.total - 1, 0) }));
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <h1 className="flex items-center gap-2 text-xl font-semibold text-slate-900">
            <ListChecks className="size-5 text-slate-400" aria-hidden />
            بانک تست
          </h1>
          <p className="text-sm text-slate-500">
            تست‌ها را در ساختار کتاب ثبت کن، علامت بزن و بعداً تلاش‌هایت را روی همین تست‌ها ثبت کن.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/books"
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-800 hover:bg-slate-50"
          >
            مدیریت کتاب‌ها
          </Link>
          <Button
            onClick={() => setCreating(true)}
            disabled={books.length === 0}
            title={books.length === 0 ? "اول یک کتاب بساز" : undefined}
          >
            <Plus className="size-4" aria-hidden />
            تست تازه
          </Button>
        </div>
      </header>

      {books.length === 0 ? (
        <FormAlert tone="info">
          برای ثبت تست، اول باید کتاب و ساختار (فصل و بخش) داشته باشی.{" "}
          <Link href="/books" className="font-medium underline">
            ساخت کتاب تازه
          </Link>
        </FormAlert>
      ) : null}

      {error ? <FormAlert>{error}</FormAlert> : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="تست‌های فعال" value={formatNumber(summary.total)} hint={`${formatNumber(summary.archived)} بایگانی`} />
        <StatCard
          label="علامت مهم"
          value={
            <span className="flex items-center gap-2">
              <Star className="size-5 text-amber-500" aria-hidden />
              {formatNumber(summary.important)}
            </span>
          }
        />
        <StatCard
          label="علامت سخت"
          value={
            <span className="flex items-center gap-2">
              <Zap className="size-5 text-rose-500" aria-hidden />
              {formatNumber(summary.hard)}
            </span>
          }
        />
        <StatCard
          label="سختی سختِ ناشر"
          value={formatNumber(summary.publisherHard)}
          hint="جدا از علامت‌های خودت"
        />
      </div>

      <Card>
        <CardHeader className="gap-3">
          <CardTitle className="flex items-center gap-2">
            <Filter className="size-4 text-slate-400" aria-hidden />
            فیلترها
          </CardTitle>

          {hasActiveFilter ? (
            <Button variant="ghost" size="sm" onClick={() => setFilters(EMPTY_FILTERS)}>
              <RotateCcw className="size-3.5" aria-hidden />
              پاک‌کردن فیلترها
            </Button>
          ) : null}
        </CardHeader>

        <CardBody className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <label className="space-y-1.5 text-sm">
              <span className="block text-slate-700">کتاب</span>
              <Select
                value={filters.bookId}
                onChange={(event) => updateFilters({ bookId: event.target.value, bookNodeId: "" })}
              >
                <option value="">همهٔ کتاب‌ها</option>
                {books.map((book) => (
                  <option key={book.id} value={book.id}>
                    {book.title} — {book.subject}
                  </option>
                ))}
              </Select>
            </label>

            <label className="space-y-1.5 text-sm">
              <span className="block text-slate-700">فصل یا بخش</span>
              <Select
                value={filters.bookNodeId}
                onChange={(event) => updateFilters({ bookNodeId: event.target.value })}
                disabled={!filters.bookId}
              >
                <option value="">همهٔ بخش‌ها</option>
                {nodeOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </label>

            <label className="space-y-1.5 text-sm">
              <span className="block text-slate-700">سختی ناشر</span>
              <Select
                value={filters.publisherDifficulty}
                onChange={(event) => updateFilters({ publisherDifficulty: event.target.value })}
              >
                <option value="">همه</option>
                {PUBLISHER_DIFFICULTIES.values.map((value) => (
                  <option key={value} value={value}>
                    {PUBLISHER_DIFFICULTIES.labels[value]}
                  </option>
                ))}
              </Select>
            </label>

            <label className="space-y-1.5 text-sm">
              <span className="block text-slate-700">جست‌وجوی شمارهٔ نمایشی</span>
              <span className="relative block">
                <Search className="absolute end-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
                <Input
                  value={filters.search}
                  onChange={(event) => updateFilters({ search: event.target.value })}
                  placeholder="مثلاً ۱۲۳"
                  className="pe-9"
                />
              </span>
            </label>
          </div>

          <div className="flex flex-wrap gap-4 rounded-xl bg-slate-50 p-4">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={filters.important}
                onChange={(event) => updateFilters({ important: event.target.checked })}
                className="size-4 accent-amber-500"
              />
              فقط مهم‌ها
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={filters.hard}
                onChange={(event) => updateFilters({ hard: event.target.checked })}
                className="size-4 accent-rose-500"
              />
              فقط سخت‌ها
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={filters.inactive}
                onChange={(event) => updateFilters({ inactive: event.target.checked })}
                className="size-4 accent-slate-600"
              />
              نمایش بایگانی‌شده‌ها
            </label>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <div className="space-y-1">
            <CardTitle>فهرست تست‌ها</CardTitle>
            <p className="text-xs text-slate-500">
              {formatNumber(list.total)} تست با فیلترهای فعلی
              {loading ? " — در حال به‌روزرسانی…" : ""}
            </p>
          </div>
        </CardHeader>

        <CardBody className="p-0">
          {list.items.length === 0 ? (
            <div className="p-5">
              <EmptyState
                icon={<ListChecks className="size-8" aria-hidden />}
                title={hasActiveFilter ? "با این فیلترها تستی پیدا نشد" : "هنوز تستی ثبت نشده است"}
                description={
                  hasActiveFilter
                    ? "فیلترها را ساده‌تر کن یا فیلترها را پاک کن."
                    : "با «تست تازه» اولین تست را داخل ساختار کتاب ثبت کن."
                }
                action={
                  hasActiveFilter ? (
                    <Button variant="secondary" onClick={() => setFilters(EMPTY_FILTERS)}>
                      پاک‌کردن فیلترها
                    </Button>
                  ) : null
                }
              />
            </div>
          ) : (
            <ul className={`divide-y divide-slate-100 ${loading ? "opacity-60" : ""}`}>
              {list.items.map((question) => (
                <li key={question.id} className="flex flex-wrap items-start justify-between gap-3 p-4">
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex h-8 min-w-14 items-center justify-center rounded-lg bg-slate-900 px-2 font-mono text-sm text-white">
                        {question.displayNumber}
                      </span>
                      <span className="text-sm text-slate-500">پاسخ: گزینهٔ {toPersianDigits(question.correctAnswer)}</span>
                      {question.publisherDifficulty ? (
                        <Badge tone="neutral">
                          ناشر:{" "}
                          {PUBLISHER_DIFFICULTIES.labels[
                            question.publisherDifficulty as keyof typeof PUBLISHER_DIFFICULTIES.labels
                          ] ?? question.publisherDifficulty}
                        </Badge>
                      ) : null}
                      {question.isImportant ? (
                        <Badge tone="warning">
                          <Star className="size-3" aria-hidden /> مهم
                        </Badge>
                      ) : null}
                      {question.isHard ? (
                        <Badge tone="danger">
                          <Zap className="size-3" aria-hidden /> سخت
                        </Badge>
                      ) : null}
                      {!question.isActive ? (
                        <Badge tone="neutral">
                          <Archive className="size-3" aria-hidden /> بایگانی
                        </Badge>
                      ) : null}
                    </div>

                    <p className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <Link href={`/books/${question.bookId}`} className="hover:text-slate-800">
                        {question.book.title}
                      </Link>
                      <span aria-hidden>•</span>
                      <span>
                        {question.bookNode.title} (
                        {BOOK_NODE_TYPE_LABELS[
                          question.bookNode.nodeType as keyof typeof BOOK_NODE_TYPE_LABELS
                        ] ?? question.bookNode.nodeType}
                        )
                      </span>
                      <span aria-hidden>•</span>
                      <span>{formatNumber(question._count.attempts)} تلاش ثبت‌شده</span>
                    </p>
                  </div>

                  <div className={`flex shrink-0 items-center gap-1 ${busyId === question.id ? "opacity-60" : ""}`}>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={question.isImportant ? "برداشتن علامت مهم" : "علامت مهم"}
                      className={question.isImportant ? "text-amber-600" : "text-slate-400"}
                      onClick={() => toggleFlag(question, "isImportant")}
                      disabled={busyId !== null}
                    >
                      <Star className="size-4" aria-hidden />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={question.isHard ? "برداشتن علامت سخت" : "علامت سخت"}
                      className={question.isHard ? "text-rose-600" : "text-slate-400"}
                      onClick={() => toggleFlag(question, "isHard")}
                      disabled={busyId !== null}
                    >
                      <Zap className="size-4" aria-hidden />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`ویرایش تست ${question.displayNumber}`}
                      onClick={() => setEditing(question)}
                    >
                      <Pencil className="size-4" aria-hidden />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={question.isActive ? "بایگانی تست" : "بازگردانی تست"}
                      onClick={() => toggleArchive(question)}
                      disabled={busyId !== null}
                    >
                      {question.isActive ? (
                        <Archive className="size-4" aria-hidden />
                      ) : (
                        <ArchiveRestore className="size-4" aria-hidden />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`حذف کامل تست ${question.displayNumber}`}
                      className="text-rose-600 hover:bg-rose-50"
                      onClick={() => setDeleting(question)}
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardBody>

        {list.pageCount > 1 ? (
          <footer className="flex items-center justify-between gap-3 border-t border-slate-100 p-4 text-sm">
            <span className="text-slate-500">
              صفحهٔ {toPersianDigits(list.page)} از {toPersianDigits(list.pageCount)}
            </span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage((value) => Math.max(value - 1, 1))} disabled={list.page <= 1 || loading}>
                قبلی
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((value) => Math.min(value + 1, list.pageCount))}
                disabled={list.page >= list.pageCount || loading}
              >
                بعدی
              </Button>
            </div>
          </footer>
        ) : null}
      </Card>

      <Dialog
        open={creating}
        title="ثبت تست تازه"
        description="شمارهٔ نمایشی و پاسخ صحیح را وارد کن؛ محل تست هم اجباری است."
        onClose={() => setCreating(false)}
      >
        <QuestionForm
          books={books}
          defaultBookId={filters.bookId || undefined}
          defaultBookNodeId={filters.bookNodeId || undefined}
          onCancel={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            void load(filters, 1);
            router.refresh();
          }}
        />
      </Dialog>

      <Dialog open={editing !== null} title="ویرایش تست" onClose={() => setEditing(null)}>
        {editing ? (
          <QuestionForm
            books={books}
            question={editing}
            onCancel={() => setEditing(null)}
            onSaved={() => {
              setEditing(null);
              void load(filters, page);
            }}
          />
        ) : null}
      </Dialog>

      <Dialog
        open={deleting !== null}
        title="حذف کامل تست"
        description="به‌جای حذف، «بایگانی» تاریخچه را نگه می‌دارد."
        onClose={() => setDeleting(null)}
      >
        {deleting ? (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
              <TriangleAlert className="mt-0.5 size-5 shrink-0" aria-hidden />
              <p>
                تست شمارهٔ <strong>{deleting.displayNumber}</strong> برای همیشه حذف می‌شود
                {deleting._count.attempts > 0
                  ? ` و ${formatNumber(deleting._count.attempts)} تلاش ثبت‌شده برای آن هم پاک می‌شود`
                  : ""}
                . اگر فقط نمی‌خواهی در تمرین‌ها بیاید، بایگانی‌اش کن.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2">
              <Button variant="ghost" onClick={() => setDeleting(null)}>
                انصراف
              </Button>
              <Button variant="secondary" onClick={() => void toggleArchive(deleting)}>
                بایگانی کن
              </Button>
              <Button variant="danger" onClick={confirmDelete}>
                حذف کامل
              </Button>
            </div>
          </div>
        ) : null}
      </Dialog>
    </div>
  );
}
