"use client";

import { useMemo, useState } from "react";
import type { Question } from "@prisma/client";

import { apiRequest } from "@/lib/api-client";
import { ANSWER_CHOICES, BOOK_NODE_TYPE_LABELS, PUBLISHER_DIFFICULTIES } from "@/lib/constants";
import { buildTree, toSelectOptions } from "@/lib/tree";
import { questionSchema, zodFieldErrors } from "@/lib/validations";

import { Button } from "@/components/ui/button";
import { Field, FormAlert } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

/** کتاب همراه گره‌های ساختارش، همان‌طور که فرم لازم دارد. */
export interface BookOption {
  id: string;
  title: string;
  subject: string;
  nodes: Array<{
    id: string;
    parentId: string | null;
    title: string;
    nodeType: string;
    orderIndex: number;
  }>;
}

/**
 * فرم ثبت/ویرایش تست.
 *
 * نکته‌های دامنه‌ای که رعایت می‌شوند:
 *   • `bookNodeId` اجباری است؛ تست بی‌محل معنا ندارد (قاعدهٔ ۲ سند مدل داده).
 *   • «پاسخ صحیح» یکی از گزینه‌های ۱ تا ۴ است.
 *   • سختی ناشر کاملاً جدا از علامت‌های «مهم» و «سخت» کاربر است (قاعدهٔ ۶).
 */
export function QuestionForm({
  books,
  question,
  defaultBookId,
  defaultBookNodeId,
  onSaved,
  onCancel,
}: {
  books: BookOption[];
  question?: Question;
  defaultBookId?: string;
  defaultBookNodeId?: string;
  onSaved: (question: Question) => void;
  onCancel: () => void;
}) {
  const [bookId, setBookId] = useState(question?.bookId ?? defaultBookId ?? books[0]?.id ?? "");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [isImportant, setIsImportant] = useState(question?.isImportant ?? false);
  const [isHard, setIsHard] = useState(question?.isHard ?? false);

  const selectedBook = books.find((book) => book.id === bookId);

  /** گزینه‌های «محل تست» از درخت همان کتاب ساخته می‌شوند (با تورفتگی و نوع گره). */
  const nodeOptions = useMemo(() => {
    if (!selectedBook) {
      return [];
    }

    const meta = new Map(selectedBook.nodes.map((node) => [node.id, node]));

    return toSelectOptions(buildTree(selectedBook.nodes)).map((option) => {
      const node = meta.get(option.id);
      const typeLabel = node
        ? (BOOK_NODE_TYPE_LABELS[node.nodeType as keyof typeof BOOK_NODE_TYPE_LABELS] ?? node.nodeType)
        : "";

      return { ...option, label: typeLabel ? `${option.label} (${typeLabel})` : option.label };
    });
  }, [selectedBook]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});

    const formData = new FormData(event.currentTarget);
    const payload = {
      bookId,
      bookNodeId: formData.get("bookNodeId") ?? "",
      displayNumber: formData.get("displayNumber"),
      correctAnswer: formData.get("correctAnswer"),
      publisherDifficulty: formData.get("publisherDifficulty") ?? "",
      isImportant,
      isHard,
    };

    const parsed = questionSchema.safeParse(payload);

    if (!parsed.success) {
      setFieldErrors(zodFieldErrors(parsed.error));
      return;
    }

    setSaving(true);

    const result = await apiRequest<Question>(question ? `/api/questions/${question.id}` : "/api/questions", {
      method: question ? "PATCH" : "POST",
      body: question ? { ...parsed.data, bookId: undefined } : parsed.data,
    });

    setSaving(false);

    if (!result.ok) {
      setFormError(result.error);
      setFieldErrors(result.fieldErrors ?? {});
      return;
    }

    onSaved(result.data);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {formError ? <FormAlert>{formError}</FormAlert> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          id="question-book"
          label="کتاب"
          required
          error={fieldErrors.bookId}
          hint={question ? "کتاب پس از ثبت تغییر نمی‌کند؛ محل تست را می‌توانی جابه‌جا کنی." : undefined}
        >
          <Select
            id="question-book"
            value={bookId}
            onChange={(event) => setBookId(event.target.value)}
            disabled={Boolean(question)}
            aria-invalid={Boolean(fieldErrors.bookId)}
          >
            {books.length === 0 ? <option value="">کتابی ثبت نشده است</option> : null}
            {books.map((book) => (
              <option key={book.id} value={book.id}>
                {book.title} — {book.subject}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          id="question-node"
          label="محل تست در ساختار کتاب"
          required
          error={fieldErrors.bookNodeId}
          hint={nodeOptions.length === 0 ? "این کتاب هنوز ساختار ندارد؛ اول فصل بساز." : undefined}
        >
          <Select
            id="question-node"
            name="bookNodeId"
            defaultValue={question?.bookNodeId ?? defaultBookNodeId ?? ""}
            disabled={nodeOptions.length === 0}
            aria-invalid={Boolean(fieldErrors.bookNodeId)}
            required
          >
            <option value="">انتخاب کن…</option>
            {nodeOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          id="question-number"
          label="شمارهٔ نمایشی"
          required
          error={fieldErrors.displayNumber}
          hint="همان شماره‌ای که در کتاب چاپ شده؛ می‌تواند تکراری باشد."
        >
          <Input
            id="question-number"
            name="displayNumber"
            dir="ltr"
            className="text-start"
            defaultValue={question?.displayNumber ?? ""}
            placeholder="مثلاً ۱۲۳"
            aria-invalid={Boolean(fieldErrors.displayNumber)}
            required
          />
        </Field>

        <Field
          id="question-difficulty"
          label="سختی اعلام‌شدهٔ ناشر"
          error={fieldErrors.publisherDifficulty}
          hint="جدا از علامت‌های خودت («مهم» و «سخت»)."
        >
          <Select
            id="question-difficulty"
            name="publisherDifficulty"
            defaultValue={question?.publisherDifficulty ?? ""}
          >
            <option value="">نامشخص</option>
            {PUBLISHER_DIFFICULTIES.values.map((value) => (
              <option key={value} value={value}>
                {PUBLISHER_DIFFICULTIES.labels[value]}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-slate-700">
          پاسخ صحیح <span className="text-rose-500">*</span>
        </legend>
        <div className="flex flex-wrap gap-2">
          {ANSWER_CHOICES.map((choice) => (
            <label
              key={choice}
              className="flex h-11 cursor-pointer items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm has-checked:border-slate-900 has-checked:bg-slate-900 has-checked:text-white"
            >
              <input
                type="radio"
                name="correctAnswer"
                value={choice}
                defaultChecked={(question?.correctAnswer ?? "1") === choice}
                className="accent-slate-900"
              />
              گزینهٔ {choice}
            </label>
          ))}
        </div>
        {fieldErrors.correctAnswer ? (
          <p role="alert" className="text-xs text-rose-600">
            {fieldErrors.correctAnswer}
          </p>
        ) : null}
      </fieldset>

      <div className="flex flex-wrap gap-4 rounded-xl bg-slate-50 p-4">
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={isImportant}
            onChange={(event) => setIsImportant(event.target.checked)}
            className="size-4 accent-amber-500"
          />
          علامت «مهم»
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={isHard}
            onChange={(event) => setIsHard(event.target.checked)}
            className="size-4 accent-rose-500"
          />
          علامت «سخت»
        </label>
      </div>

      <div className="flex items-center justify-end gap-2 pt-2">
        <Button variant="ghost" onClick={onCancel} disabled={saving}>
          انصراف
        </Button>
        <Button type="submit" disabled={saving || books.length === 0}>
          {saving ? "در حال ذخیره…" : question ? "ذخیرهٔ تغییرها" : "ثبت تست"}
        </Button>
      </div>
    </form>
  );
}
