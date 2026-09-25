"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Flag, Flame } from "lucide-react";
import { BookTree } from "@/components/BookTree";
import { Alert, Button, EmptyState, Field, PageHeader, ResultBadge, SelectInput, Spinner, TextInput } from "@/components/ui";
import { api } from "@/lib/api";
import { errorMessage, formatCount, formatPercent, shortId } from "@/lib/format";
import { DIFFICULTIES, NODE_TYPES, PERCENT_NOTE } from "@/lib/labels";
import { findNode, flattenNodes } from "@/lib/tree";
import type { BookDetail, BookNode, NodeType, Page, Question } from "@/types";

export default function BookDetailPage() {
  const params = useParams<{ bookId: string }>();
  const router = useRouter();
  const [book, setBook] = useState<BookDetail | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [questionsLoading, setQuestionsLoading] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [reloadQuestions, setReloadQuestions] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [nodeTitle, setNodeTitle] = useState("");
  const [advancedType, setAdvancedType] = useState<NodeType>("subsection");
  const [advancedParent, setAdvancedParent] = useState("");
  const [rename, setRename] = useState("");

  const [displayNumber, setDisplayNumber] = useState("");
  const [correctAnswer, setCorrectAnswer] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [important, setImportant] = useState(false);
  const [hard, setHard] = useState(false);
  const [pending, setPending] = useState(false);

  async function loadBook(preferId?: string | null) {
    const data = await api<BookDetail>(`/books/${params.bookId}`);
    setBook(data);
    setSelectedId((current) => {
      const wanted = preferId ?? current;
      if (wanted && findNode(data.nodes, wanted)) return wanted;
      return data.nodes[0]?.id ?? null;
    });
    return data;
  }

  useEffect(() => {
    document.title = "کتاب | TSP";
    setLoading(true);
    loadBook()
      .catch((err: unknown) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.bookId]);

  useEffect(() => {
    if (!selectedId) {
      setQuestions([]);
      return;
    }
    let cancelled = false;
    setQuestionsLoading(true);
    const query = new URLSearchParams({ book_node_id: selectedId, size: "100" });
    if (showArchived) query.set("include_inactive", "true");
    api<Page<Question>>(`/questions?${query.toString()}`)
      .then((page) => {
        if (!cancelled) setQuestions(page.items);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(errorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setQuestionsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId, showArchived, reloadQuestions]);

  const selected = book && selectedId ? findNode(book.nodes, selectedId) : null;

  useEffect(() => {
    setRename(selected?.title ?? "");
  }, [selected?.id, selected?.title]);

  async function addNode(nodeType: NodeType, parentId: string | null, title: string) {
    if (!title.trim()) {
      setError("عنوان گره را وارد کنید.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const node = await api<BookNode>(`/books/${params.bookId}/nodes`, {
        method: "POST",
        body: JSON.stringify({ title: title.trim(), node_type: nodeType, parent_id: parentId }),
      });
      setNodeTitle("");
      setNotice(nodeType === "chapter" ? "فصل اضافه شد." : "گره ساختاری اضافه شد.");
      await loadBook(node.id);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  async function saveRename(event: FormEvent) {
    event.preventDefault();
    if (!selected || !rename.trim()) return;
    setPending(true);
    try {
      await api(`/nodes/${selected.id}`, { method: "PATCH", body: JSON.stringify({ title: rename.trim() }) });
      await loadBook(selected.id);
      setNotice("عنوان گره ذخیره شد.");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  async function moveSelected(direction: -1 | 1) {
    if (!book || !selected) return;
    const siblings = selected.parent_id ? findNode(book.nodes, selected.parent_id)?.children ?? [] : book.nodes;
    const index = siblings.findIndex((node) => node.id === selected.id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= siblings.length) return;
    const next = [...siblings];
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item);
    setPending(true);
    try {
      await Promise.all(
        next.map((node, order) =>
          api(`/nodes/${node.id}`, { method: "PATCH", body: JSON.stringify({ order_index: order }) }),
        ),
      );
      await loadBook(selected.id);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  async function removeSelected() {
    if (!selected) return;
    if (!window.confirm(`گره «${selected.title}» حذف شود؟`)) return;
    setPending(true);
    try {
      await api(`/nodes/${selected.id}`, { method: "DELETE" });
      setNotice("گره حذف شد.");
      await loadBook(null);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  async function addQuestion(event: FormEvent) {
    event.preventDefault();
    if (!selected) {
      setError("ابتدا یک فصل یا بخش را انتخاب کنید.");
      return;
    }
    if (!displayNumber.trim() || !correctAnswer.trim()) {
      setError("شماره تست و پاسخ صحیح الزامی است.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      await api("/questions", {
        method: "POST",
        body: JSON.stringify({
          book_id: params.bookId,
          book_node_id: selected.id,
          display_number: displayNumber.trim(),
          correct_answer: correctAnswer.trim(),
          publisher_difficulty: difficulty || null,
          is_important: important,
          is_hard: hard,
        }),
      });
      setDisplayNumber("");
      setCorrectAnswer("");
      setDifficulty("");
      setImportant(false);
      setHard(false);
      setNotice("تست ثبت شد. متن سؤال ذخیره نمی‌شود.");
      setReloadQuestions((value) => value + 1);
      await loadBook(selected.id);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  async function archiveBook() {
    if (!book) return;
    if (!window.confirm("کتاب آرشیو شود؟")) return;
    try {
      await api(`/books/${book.id}`, { method: "DELETE" });
      router.push("/books");
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  if (loading) return <Spinner />;
  if (!book) return <Alert>{error || "کتاب پیدا نشد."}</Alert>;

  const flat = flattenNodes(book.nodes);

  return (
    <div>
      <PageHeader
        eyebrow={book.subject}
        title={book.title}
        description={[book.publisher, book.grade, book.field].filter(Boolean).join(" · ") || "ساختار این کتاب را خودتان می‌چینید."}
        action={
          <div className="flex gap-2">
            <Link href={`/books/${book.id}/edit`} className="inline-flex h-11 items-center rounded-xl border border-line bg-white px-4 text-sm font-semibold">
              ویرایش
            </Link>
            <Button type="button" variant="danger" onClick={archiveBook}>آرشیو</Button>
          </div>
        }
      />
      {!book.is_active ? <div className="mb-4"><Alert tone="info">این کتاب آرشیو شده است. از صفحه ویرایش می‌توانید آن را برگردانید.</Alert></div> : null}
      {error ? <div className="mb-4"><Alert>{error}</Alert></div> : null}
      {notice ? <div className="mb-4"><Alert tone="success">{notice}</Alert></div> : null}

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <Mini label="تست‌ها" value={formatCount(book.question_count)} />
        <Mini label="تلاش‌ها" value={formatCount(book.stats.total)} />
        <Mini label="درصد کتاب" value={formatPercent(book.stats.percentage)} />
      </div>
      <p className="mb-5 text-xs leading-6 text-muted">{PERCENT_NOTE}</p>

      <div className="grid items-start gap-4 lg:grid-cols-[20rem_1fr]">
        <section className="panel p-4">
          <h2 className="mb-3 text-base font-extrabold">ساختار کتاب</h2>
          <BookTree nodes={book.nodes} selectedId={selectedId} onSelect={setSelectedId} />
          <form
            className="mt-4 space-y-3 border-t border-line pt-4"
            onSubmit={(event) => {
              event.preventDefault();
              void addNode("chapter", null, nodeTitle);
            }}
          >
            <Field label="عنوان فصل یا بخش">
              <TextInput value={nodeTitle} onChange={(event) => setNodeTitle(event.target.value)} placeholder="مثلاً فصل ۱" />
            </Field>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={pending || !book.is_active}>افزودن فصل</Button>
              <Button
                type="button"
                variant="secondary"
                disabled={pending || !selected || !book.is_active}
                onClick={() => void addNode("section", selected?.id ?? null, nodeTitle)}
              >
                افزودن بخش زیر گره انتخاب‌شده
              </Button>
            </div>
          </form>
          <details className="mt-4 text-sm">
            <summary className="cursor-pointer font-semibold text-muted">گره سفارشی</summary>
            <div className="mt-3 space-y-3">
              <Field label="نوع">
                <SelectInput value={advancedType} onChange={(event) => setAdvancedType(event.target.value as NodeType)}>
                  {NODE_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </SelectInput>
              </Field>
              <Field label="والد">
                <SelectInput value={advancedParent} onChange={(event) => setAdvancedParent(event.target.value)}>
                  <option value="">بدون والد (ریشه)</option>
                  {flat.map(({ node, depth }) => (
                    <option key={node.id} value={node.id}>{"— ".repeat(depth)}{node.title}</option>
                  ))}
                </SelectInput>
              </Field>
              <Button
                type="button"
                variant="secondary"
                disabled={pending}
                onClick={() => void addNode(advancedType, advancedParent || null, nodeTitle)}
              >
                افزودن گره
              </Button>
            </div>
          </details>
        </section>

        <section className="space-y-4">
          {!selected ? (
            <EmptyState title="یک فصل انتخاب کنید" body="اول فصل را بسازید، بعد بخش و تست را به همان گره اضافه کنید." />
          ) : (
            <>
              <div className="panel p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold text-pine">{NODE_TYPES.find(([value]) => value === selected.node_type)?.[1]}</p>
                    <h2 className="text-xl font-extrabold">{selected.title}</h2>
                  </div>
                  <div className="flex gap-1">
                    <Button type="button" variant="ghost" className="h-9 px-2" onClick={() => void moveSelected(-1)} aria-label="بالا"><ArrowUp size={16} /></Button>
                    <Button type="button" variant="ghost" className="h-9 px-2" onClick={() => void moveSelected(1)} aria-label="پایین"><ArrowDown size={16} /></Button>
                    <Button type="button" variant="danger" className="h-9" onClick={() => void removeSelected()}>حذف گره</Button>
                  </div>
                </div>
                <form onSubmit={saveRename} className="mt-3 flex gap-2">
                  <TextInput value={rename} onChange={(event) => setRename(event.target.value)} />
                  <Button type="submit" variant="secondary" disabled={pending}>تغییر عنوان</Button>
                </form>
              </div>

              <form onSubmit={addQuestion} className="panel space-y-3 p-4">
                <h3 className="font-extrabold">افزودن تست</h3>
                <p className="text-xs leading-6 text-muted">فقط شماره نمایشی و پاسخ صحیح. شماره یکتا نیست و متن سؤال ذخیره نمی‌شود.</p>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field label="شماره نمایشی">
                    <TextInput value={displayNumber} onChange={(event) => setDisplayNumber(event.target.value)} placeholder="۱۲" />
                  </Field>
                  <Field label="پاسخ صحیح">
                    <TextInput value={correctAnswer} onChange={(event) => setCorrectAnswer(event.target.value)} placeholder="۳" />
                  </Field>
                  <Field label="سختی ناشر">
                    <TextInput list="difficulties" value={difficulty} onChange={(event) => setDifficulty(event.target.value)} placeholder="اختیاری" />
                    <datalist id="difficulties">{DIFFICULTIES.map((item) => <option key={item} value={item} />)}</datalist>
                  </Field>
                </div>
                <div className="flex flex-wrap items-center gap-4 text-sm">
                  <label className="flex items-center gap-2"><input type="checkbox" checked={important} onChange={(event) => setImportant(event.target.checked)} /> مهم</label>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={hard} onChange={(event) => setHard(event.target.checked)} /> سخت</label>
                  <Button type="submit" disabled={pending || !book.is_active}>{pending ? "در حال ثبت..." : "ثبت تست"}</Button>
                </div>
              </form>

              <div className="panel p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="font-extrabold">تست‌های این گره</h3>
                  <label className="flex items-center gap-2 text-xs text-muted">
                    <input type="checkbox" checked={showArchived} onChange={(event) => setShowArchived(event.target.checked)} />
                    آرشیوشده‌ها
                  </label>
                </div>
                {questionsLoading ? <Spinner label="در حال خواندن تست‌ها..." /> : null}
                {!questionsLoading && questions.length === 0 ? (
                  <EmptyState title="تستی در این گره نیست" body="شماره و پاسخ صحیح را بالا وارد کنید." />
                ) : null}
                <ul className="divide-y divide-line">
                  {questions.map((question) => (
                    <li key={question.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                      <div>
                        <p className="text-lg font-extrabold">تست {question.display_number}</p>
                        <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                          <span>شناسه {shortId(question.id)}</span>
                          <span>{formatCount(question.attempt_count)} تلاش</span>
                          {question.publisher_difficulty ? <span>سختی ناشر: {question.publisher_difficulty}</span> : null}
                          {question.is_important ? <span className="inline-flex items-center gap-1 text-copper"><Flag size={12} /> مهم</span> : null}
                          {question.is_hard ? <span className="inline-flex items-center gap-1"><Flame size={12} /> سخت</span> : null}
                          {!question.is_active ? <span>آرشیو</span> : null}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <ResultBadge result={question.latest_result} />
                        {!question.is_active ? (
                          <Button
                            type="button"
                            variant="secondary"
                            className="h-10"
                            onClick={() => {
                          void api<Question>(`/questions/${question.id}`, {
                            method: "PATCH",
                            body: JSON.stringify({ is_active: true }),
                          })
                            .then(() => {
                              setReloadQuestions((value) => value + 1);
                              void loadBook(selectedId);
                            })
                            .catch((err: unknown) => setError(errorMessage(err)));
                        }}
                          >
                            بازگردانی
                          </Button>
                        ) : null}
                        <Link href={`/questions/${question.id}`} className="inline-flex h-10 items-center rounded-xl bg-pine px-4 text-sm font-bold text-white">
                          {question.is_active ? "حل تست" : "مشاهده"}
                        </Link>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="panel px-4 py-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="text-xl font-extrabold tabular-nums">{value}</p>
    </div>
  );
}
