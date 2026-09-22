"use client";

import { useState } from "react";
import type { Book } from "@prisma/client";

import { apiRequest } from "@/lib/api-client";
import { COMMON_SUBJECTS, GRADES, STUDY_FIELDS } from "@/lib/constants";
import { bookSchema, zodFieldErrors } from "@/lib/validations";

import { Button } from "@/components/ui/button";
import { Field, FormAlert } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

/**
 * فرم ساخت/ویرایش کتاب.
 *
 * اعتبارسنجی با همان طرح سرور (`bookSchema`) انجام می‌شود تا پیام‌های خطا یکسان
 * باشند؛ سپس نتیجه به API فرستاده می‌شود و کتاب تازه به والد برگردانده می‌شود.
 */
export function BookForm({
  book,
  onSaved,
  onCancel,
}: {
  book?: Book;
  onSaved: (book: Book) => void;
  onCancel: () => void;
}) {
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});

    const formData = new FormData(event.currentTarget);
    const parsed = bookSchema.safeParse({
      title: formData.get("title"),
      subject: formData.get("subject") ?? "",
      publisher: formData.get("publisher") ?? "",
      grade: formData.get("grade") ?? "",
      field: formData.get("field") ?? "",
      notes: formData.get("notes") ?? "",
    });

    if (!parsed.success) {
      setFieldErrors(zodFieldErrors(parsed.error));
      return;
    }

    setSaving(true);

    const result = await apiRequest<Book>(book ? `/api/books/${book.id}` : "/api/books", {
      method: book ? "PATCH" : "POST",
      body: parsed.data,
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

      <Field id="title" label="عنوان کتاب" required error={fieldErrors.title}>
        <Input
          id="title"
          name="title"
          defaultValue={book?.title ?? ""}
          placeholder="مثلاً فیزیک جامع کنکور — جلد ۱"
          aria-invalid={Boolean(fieldErrors.title)}
          required
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          id="subject"
          label="درس"
          required
          error={fieldErrors.subject}
          hint="درس، مبنای گروه‌بندی کتاب‌ها و آمار مبحثی است."
        >
          <Input
            id="subject"
            name="subject"
            list="common-subjects"
            defaultValue={book?.subject ?? ""}
            placeholder="مثلاً فیزیک"
            aria-invalid={Boolean(fieldErrors.subject)}
            required
          />
          <datalist id="common-subjects">
            {COMMON_SUBJECTS.map((subject) => (
              <option key={subject} value={subject} />
            ))}
          </datalist>
        </Field>

        <Field id="publisher" label="ناشر" error={fieldErrors.publisher}>
          <Input id="publisher" name="publisher" defaultValue={book?.publisher ?? ""} placeholder="اختیاری" />
        </Field>

        <Field id="grade" label="پایه" error={fieldErrors.grade}>
          <Select id="grade" name="grade" defaultValue={book?.grade ?? ""}>
            <option value="">انتخاب کنید…</option>
            {GRADES.map((grade) => (
              <option key={grade} value={grade}>
                {grade}
              </option>
            ))}
          </Select>
        </Field>

        <Field id="field" label="رشته" error={fieldErrors.field}>
          <Select id="field" name="field" defaultValue={book?.field ?? ""}>
            <option value="">انتخاب کنید…</option>
            {STUDY_FIELDS.map((field) => (
              <option key={field} value={field}>
                {field}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field id="notes" label="یادداشت" error={fieldErrors.notes} hint="هر توضیحی که برای خودت لازم داری.">
        <Textarea id="notes" name="notes" defaultValue={book?.notes ?? ""} placeholder="اختیاری" />
      </Field>

      <div className="flex items-center justify-end gap-2 pt-2">
        <Button variant="ghost" onClick={onCancel} disabled={saving}>
          انصراف
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "در حال ذخیره…" : book ? "ذخیرهٔ تغییرها" : "ساخت کتاب"}
        </Button>
      </div>
    </form>
  );
}
