"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  CornerDownLeft,
  ListTree,
  Pencil,
  Plus,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { apiRequest } from "@/lib/api-client";
import { BOOK_NODE_TYPE_LABELS } from "@/lib/constants";
import { formatNumber } from "@/lib/format";
import type { BookDetail, BookNodeWithCount } from "@/lib/services/books";
import { buildTree, collectSubtreeIds, flattenTree } from "@/lib/tree";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle, StatCard } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { FormAlert } from "@/components/ui/field";
import { NodeForm, type ParentOption } from "@/components/library/node-form";

/** گرهٔ درختی‌شده همراه تعداد تست‌ها. */
type NodeItem = BookNodeWithCount;

/**
 * مدیریت ساختار یک کتاب: نمایش درختی فصل‌ها و بخش‌ها و کارهای افزودن، ویرایش،
 * جابه‌جایی و حذف.
 *
 * ساختار درخت از `BookNode.parentId` ساخته می‌شود؛ `orderIndex` ترتیب نمایش
 * بین هم‌سطح‌ها را تعیین می‌کند.
 */
export function BookStructure({ detail }: { detail: BookDetail }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [creatingParentId, setCreatingParentId] = useState<string | null | undefined>(undefined);
  const [editing, setEditing] = useState<NodeItem | null>(null);
  const [deleting, setDeleting] = useState<NodeItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyNodeId, setBusyNodeId] = useState<string | null>(null);

  const tree = useMemo(() => buildTree(detail.nodes), [detail.nodes]);
  const rows = useMemo(() => flattenTree(tree), [tree]);

  /** گزینه‌های «داخلِ» برای فرم گره؛ خودِ گره و زیرگره‌هایش حذف می‌شوند. */
  const parentOptions: ParentOption[] = useMemo(() => {
    const excluded = new Set<string>();

    if (editing) {
      const branch = rows.find((row) => row.node.id === editing.id);

      if (branch) {
        for (const id of collectSubtreeIds(branch.node)) {
          excluded.add(id);
        }
      }
    }

    return rows
      .filter((row) => !excluded.has(row.node.id))
      .map((row) => ({ id: row.node.id, label: `${"— ".repeat(row.depth)}${row.node.title}` }));
  }, [editing, rows]);

  function refresh() {
    startTransition(() => router.refresh());
  }

  async function move(node: NodeItem, direction: "up" | "down") {
    setError(null);
    setBusyNodeId(node.id);

    const result = await apiRequest(`/api/books/${detail.book.id}/nodes/${node.id}`, {
      method: "PATCH",
      body: { move: direction },
    });

    setBusyNodeId(null);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    refresh();
  }

  async function confirmDelete() {
    if (!deleting) {
      return;
    }

    const result = await apiRequest(`/api/books/${detail.book.id}/nodes/${deleting.id}`, { method: "DELETE" });

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setDeleting(null);
    refresh();
  }

  /** تعداد گره‌ها و تست‌هایی که با حذف این گره از بین می‌روند. */
  const deleteImpact = useMemo(() => {
    if (!deleting) {
      return { nodes: 0, questions: 0 };
    }

    const branch = rows.find((row) => row.node.id === deleting.id);

    if (!branch) {
      return { nodes: 1, questions: deleting._count.questions };
    }

    const ids = collectSubtreeIds(branch.node);
    const questions = ids.reduce((total, id) => {
      const item = rows.find((row) => row.node.id === id);

      return total + (item?.node._count.questions ?? 0);
    }, 0);

    return { nodes: ids.length, questions };
  }, [deleting, rows]);

  return (
    <div className="space-y-6">
      <nav aria-label="مسیر صفحه" className="flex items-center gap-2 text-sm text-slate-500">
        <Link href="/books" className="inline-flex items-center gap-1 hover:text-slate-800">
          <ArrowRight className="size-4" aria-hidden />
          کتاب‌ها
        </Link>
        <span aria-hidden>/</span>
        <span className="text-slate-800">{detail.book.title}</span>
      </nav>

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-xl font-semibold text-slate-900">{detail.book.title}</h1>
          <p className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <Badge tone="info">{detail.book.subject}</Badge>
            {detail.book.publisher ? <span>{detail.book.publisher}</span> : null}
            {detail.book.grade ? <span>• {detail.book.grade}</span> : null}
            {detail.book.field ? <span>• {detail.book.field}</span> : null}
          </p>
          {detail.book.notes ? <p className="max-w-2xl text-sm text-slate-600">{detail.book.notes}</p> : null}
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/questions?bookId=${detail.book.id}`}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-800 hover:bg-slate-50"
          >
            تست‌های این کتاب
          </Link>
          <Button onClick={() => setCreatingParentId(null)} className={isPending ? "opacity-80" : undefined}>
            <Plus className="size-4" aria-hidden />
            فصل تازه
          </Button>
        </div>
      </header>

      {error ? <FormAlert>{error}</FormAlert> : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="فصل و بخش" value={formatNumber(detail.stats.nodeCount)} />
        <StatCard
          label="تست‌ها"
          value={formatNumber(detail.stats.questionCount)}
          hint={detail.stats.inactiveCount > 0 ? `${formatNumber(detail.stats.inactiveCount)} بایگانی‌شده` : undefined}
        />
        <StatCard label="علامت مهم" value={formatNumber(detail.stats.importantCount)} />
        <StatCard label="سخت (علامت یا ناشر)" value={formatNumber(detail.stats.hardCount + detail.stats.publisherHardCount)} />
      </div>

      <Card>
        <CardHeader>
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <ListTree className="size-4 text-slate-400" aria-hidden />
              ساختار کتاب
            </CardTitle>
            <p className="text-xs text-slate-500">
              ترتیب نمایش با دکمه‌های بالا/پایین بین هم‌سطح‌ها تنظیم می‌شود.
            </p>
          </div>
        </CardHeader>

        <CardBody className="space-y-2">
          {rows.length === 0 ? (
            <EmptyState
              icon={<ListTree className="size-8" aria-hidden />}
              title="ساختار این کتاب خالی است"
              description="با «فصل تازه» شروع کن؛ بعد داخل هر فصل می‌توانی بخش و زیربخش بسازی."
            />
          ) : (
            <ul className="divide-y divide-slate-100">
              {rows.map(({ node, depth }) => (
                <li
                  key={node.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-2.5"
                  style={{ paddingInlineStart: `${depth * 1.25}rem` }}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    {depth > 0 ? (
                      <CornerDownLeft className="size-3.5 shrink-0 text-slate-300" aria-hidden />
                    ) : null}
                    <span className={depth === 0 ? "text-sm font-medium text-slate-900" : "text-sm text-slate-700"}>
                      {node.title}
                    </span>
                    <Badge tone={node.nodeType === "chapter" ? "info" : "neutral"}>
                      {BOOK_NODE_TYPE_LABELS[node.nodeType as keyof typeof BOOK_NODE_TYPE_LABELS] ?? node.nodeType}
                    </Badge>
                    <span className="text-xs text-slate-400">{formatNumber(node._count.questions)} تست</span>
                  </div>

                  <div
                    className={`flex shrink-0 items-center gap-1 ${busyNodeId === node.id ? "opacity-60" : ""}`}
                  >
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setCreatingParentId(node.id)}
                      className="text-slate-600"
                    >
                      <Plus className="size-3.5" aria-hidden />
                      زیربخش
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`انتقال ${node.title} به بالا`}
                      onClick={() => move(node, "up")}
                      disabled={busyNodeId !== null}
                    >
                      <ArrowUp className="size-4" aria-hidden />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`انتقال ${node.title} به پایین`}
                      onClick={() => move(node, "down")}
                      disabled={busyNodeId !== null}
                    >
                      <ArrowDown className="size-4" aria-hidden />
                    </Button>
                    <Button variant="ghost" size="icon" aria-label={`ویرایش ${node.title}`} onClick={() => setEditing(node)}>
                      <Pencil className="size-4" aria-hidden />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`حذف ${node.title}`}
                      className="text-rose-600 hover:bg-rose-50"
                      onClick={() => setDeleting(node)}
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <Dialog
        open={creatingParentId !== undefined}
        title="افزودن به ساختار"
        description="نوع گره را انتخاب کن؛ برای فصل سطح اصلی، «داخلِ» را خالی بگذار."
        onClose={() => setCreatingParentId(undefined)}
      >
        <NodeForm
          bookId={detail.book.id}
          parentOptions={parentOptions}
          defaultParentId={creatingParentId ?? undefined}
          onCancel={() => setCreatingParentId(undefined)}
          onSaved={() => {
            setCreatingParentId(undefined);
            refresh();
          }}
        />
      </Dialog>

      <Dialog open={editing !== null} title="ویرایش گره" onClose={() => setEditing(null)}>
        {editing ? (
          <NodeForm
            bookId={detail.book.id}
            node={editing}
            parentOptions={parentOptions}
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
        title="حذف گره از ساختار"
        description="این کار قابل بازگشت نیست."
        onClose={() => setDeleting(null)}
      >
        {deleting ? (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
              <TriangleAlert className="mt-0.5 size-5 shrink-0" aria-hidden />
              <p>
                «{deleting.title}» همراه {formatNumber(Math.max(deleteImpact.nodes - 1, 0))} زیرگره و{" "}
                {formatNumber(deleteImpact.questions)} تست حذف می‌شود.
                {deleteImpact.questions > 0
                  ? " اگر می‌خواهی تاریخچهٔ تلاش‌ها بماند، به‌جای حذف گره، تست‌ها را بایگانی کن."
                  : ""}
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
