"use client";

import { useParams, useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { Alert, Button, Field, PageHeader, SelectInput, Spinner, TextArea, TextInput } from "@/components/ui";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/format";
import { GRADES, SUBJECTS } from "@/lib/labels";
import type { BookDetail } from "@/types";

export default function EditBookPage() {
  const params = useParams<{ bookId: string }>();
  const router = useRouter();
  const [book, setBook] = useState<BookDetail | null>(null);
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [publisher, setPublisher] = useState("");
  const [grade, setGrade] = useState("");
  const [field, setField] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    document.title = "ویرایش کتاب | TSP";
    api<BookDetail>(`/books/${params.bookId}`)
      .then((data) => {
        setBook(data);
        setTitle(data.title);
        setSubject(data.subject);
        setPublisher(data.publisher ?? "");
        setGrade(data.grade ?? "");
        setField(data.field ?? "ریاضی-فیزیک");
        setNotes(data.notes ?? "");
      })
      .catch((err: unknown) => setError(errorMessage(err)));
  }, [params.bookId]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!title.trim() || !subject.trim()) {
      setError("عنوان و درس الزامی است.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      await api(`/books/${params.bookId}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: title.trim(),
          subject: subject.trim(),
          publisher: publisher.trim() || null,
          grade: grade || null,
          field: field.trim() || null,
          notes: notes.trim() || null,
        }),
      });
      router.push(`/books/${params.bookId}`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  async function restore() {
    setPending(true);
    try {
      await api(`/books/${params.bookId}`, { method: "PATCH", body: JSON.stringify({ is_active: true }) });
      router.push(`/books/${params.bookId}`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  if (error && !book) return <Alert>{error}</Alert>;
  if (!book) return <Spinner />;

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader eyebrow="کتابخانه" title="ویرایش کتاب" />
      {!book.is_active ? (
        <div className="mb-4">
          <Alert tone="info">این کتاب آرشیو شده است. می‌توانید آن را بازگردانید.</Alert>
          <Button type="button" className="mt-3" variant="secondary" onClick={restore} disabled={pending}>بازگرداندن از آرشیو</Button>
        </div>
      ) : null}
      <form onSubmit={onSubmit} className="panel space-y-4 p-5">
        {error ? <Alert>{error}</Alert> : null}
        <Field label="عنوان کتاب">
          <TextInput value={title} onChange={(event) => setTitle(event.target.value)} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="درس">
            <TextInput list="subjects" value={subject} onChange={(event) => setSubject(event.target.value)} />
            <datalist id="subjects">{SUBJECTS.map((item) => <option key={item} value={item} />)}</datalist>
          </Field>
          <Field label="ناشر">
            <TextInput value={publisher} onChange={(event) => setPublisher(event.target.value)} />
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
        <Field label="یادداشت">
          <TextArea value={notes} onChange={(event) => setNotes(event.target.value)} />
        </Field>
        <div className="flex gap-2">
          <Button type="submit" disabled={pending}>{pending ? "در حال ذخیره..." : "ذخیره"}</Button>
          <Button type="button" variant="secondary" onClick={() => router.push(`/books/${params.bookId}`)}>بازگشت</Button>
        </div>
      </form>
    </div>
  );
}
