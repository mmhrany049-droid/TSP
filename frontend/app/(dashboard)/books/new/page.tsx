"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { Alert, Button, Field, PageHeader, SelectInput, TextArea, TextInput } from "@/components/ui";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/format";
import { GRADES, SUBJECTS } from "@/lib/labels";
import type { Book } from "@/types";

export default function NewBookPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("شیمی");
  const [publisher, setPublisher] = useState("");
  const [grade, setGrade] = useState("یازدهم");
  const [field, setField] = useState("ریاضی-فیزیک");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    document.title = "کتاب جدید | TSP";
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!title.trim() || !subject.trim()) {
      setError("عنوان و درس الزامی است.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const book = await api<Book>("/books", {
        method: "POST",
        body: JSON.stringify({
          title: title.trim(),
          subject: subject.trim(),
          publisher: publisher.trim() || null,
          grade: grade.trim() || null,
          field: field.trim() || "ریاضی-فیزیک",
          notes: notes.trim() || null,
        }),
      });
      router.push(`/books/${book.id}`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader eyebrow="کتابخانه" title="کتاب جدید" description="بعد از ساخت، فصل و بخش را به ساختار کتاب اضافه کنید." />
      <form onSubmit={onSubmit} className="panel space-y-4 p-5">
        {error ? <Alert>{error}</Alert> : null}
        <Field label="عنوان کتاب">
          <TextInput value={title} onChange={(event) => setTitle(event.target.value)} placeholder="مثلاً شیمی ۲ مبتکران" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="درس">
            <TextInput list="subjects" value={subject} onChange={(event) => setSubject(event.target.value)} />
            <datalist id="subjects">
              {SUBJECTS.map((item) => <option key={item} value={item} />)}
            </datalist>
          </Field>
          <Field label="ناشر">
            <TextInput value={publisher} onChange={(event) => setPublisher(event.target.value)} placeholder="مثلاً مبتکران" />
          </Field>
          <Field label="پایه">
            <SelectInput value={grade} onChange={(event) => setGrade(event.target.value)}>
              <option value="">نامشخص</option>
              {GRADES.map((item) => <option key={item} value={item}>{item}</option>)}
            </SelectInput>
          </Field>
          <Field label="رشته">
            <TextInput value={field} onChange={(event) => setField(event.target.value)} />
          </Field>
        </div>
        <Field label="یادداشت" hint="اختیاری">
          <TextArea value={notes} onChange={(event) => setNotes(event.target.value)} />
        </Field>
        <div className="flex gap-2">
          <Button type="submit" disabled={pending}>{pending ? "در حال ذخیره..." : "ساخت کتاب"}</Button>
          <Button type="button" variant="secondary" onClick={() => router.push("/books")}>انصراف</Button>
        </div>
      </form>
    </div>
  );
}
