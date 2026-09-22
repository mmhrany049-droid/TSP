"use client";

import { useState } from "react";
import type { BookNode } from "@prisma/client";

import { apiRequest } from "@/lib/api-client";
import { BOOK_NODE_TYPES, BOOK_NODE_TYPE_LABELS } from "@/lib/constants";
import { bookNodeSchema, zodFieldErrors } from "@/lib/validations";

import { Button } from "@/components/ui/button";
import { Field, FormAlert } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

/** گزینهٔ والد که در فهرست کشویی نمایش داده می‌شود. */
export interface ParentOption {
  id: string;
  label: string;
}

/**
 * فرم افزودن/ویرایش گرهٔ ساختار کتاب (فصل، بخش، زیربخش، تست‌های مخلوط و …).
 *
 * `parentOptions` از درخت فعلی ساخته می‌شود؛ برای ویرایش، خودِ گره و زیرگره‌هایش
 * از فهرست کنار گذاشته می‌شوند تا والد یک گره، فرزند خودش نشود.
 */
export function NodeForm({
  bookId,
  node,
  parentOptions,
  defaultParentId,
  onSaved,
  onCancel,
}: {
  bookId: string;
  node?: BookNode;
  parentOptions: ParentOption[];
  defaultParentId?: string;
  onSaved: () => void;
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
    const parsed = bookNodeSchema.safeParse({
      title: formData.get("title"),
      nodeType: formData.get("nodeType"),
      parentId: formData.get("parentId") ?? "",
      orderIndex: formData.get("orderIndex") ?? 0,
    });

    if (!parsed.success) {
      setFieldErrors(zodFieldErrors(parsed.error));
      return;
    }

    setSaving(true);

    const result = await apiRequest<BookNode>(
      node ? `/api/books/${bookId}/nodes/${node.id}` : `/api/books/${bookId}/nodes`,
      { method: node ? "PATCH" : "POST", body: parsed.data },
    );

    setSaving(false);

    if (!result.ok) {
      setFormError(result.error);
      setFieldErrors(result.fieldErrors ?? {});
      return;
    }

    onSaved();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {formError ? <FormAlert>{formError}</FormAlert> : null}

      <Field id="node-title" label="عنوان" required error={fieldErrors.title}>
        <Input
          id="node-title"
          name="title"
          defaultValue={node?.title ?? ""}
          placeholder="مثلاً فصل ۱ — حرکت‌شناسی"
          aria-invalid={Boolean(fieldErrors.title)}
          required
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          id="node-type"
          label="نوع"
          required
          error={fieldErrors.nodeType}
          hint="نوع گره فقط برای دسته‌بندی و نمایش است."
        >
          <Select id="node-type" name="nodeType" defaultValue={node?.nodeType ?? "chapter"}>
            {BOOK_NODE_TYPES.values.map((type) => (
              <option key={type} value={type}>
                {BOOK_NODE_TYPE_LABELS[type]}
              </option>
            ))}
          </Select>
        </Field>

        <Field id="node-order" label="ترتیب" error={fieldErrors.orderIndex} hint="عدد کوچک‌تر بالاتر می‌آید.">
          <Input
            id="node-order"
            name="orderIndex"
            type="number"
            min={0}
            dir="ltr"
            defaultValue={node?.orderIndex ?? 0}
            aria-invalid={Boolean(fieldErrors.orderIndex)}
          />
        </Field>
      </div>

      <Field id="node-parent" label="داخلِ" error={fieldErrors.parentId} hint="خالی بگذار تا در سطح فصل‌های اصلی بیاید.">
        <Select id="node-parent" name="parentId" defaultValue={node?.parentId ?? defaultParentId ?? ""}>
          <option value="">— سطح اصلی کتاب —</option>
          {parentOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </Select>
      </Field>

      <div className="flex items-center justify-end gap-2 pt-2">
        <Button variant="ghost" onClick={onCancel} disabled={saving}>
          انصراف
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "در حال ذخیره…" : node ? "ذخیرهٔ تغییرها" : "افزودن"}
        </Button>
      </div>
    </form>
  );
}
