"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { Alert, Button, Field, PageHeader, PercentBar, ResultBadge, Spinner, TextInput } from "@/components/ui";
import { api } from "@/lib/api";
import { errorMessage, formatCount, formatJalali, formatSeconds, shortId, toFaDigits } from "@/lib/format";
import { NODE_TYPE_LABELS, PERCENT_NOTE, RESULT_LABELS, SOURCE_LABELS } from "@/lib/labels";
import type { Attempt, AttemptCreated, Page, Question, Stats } from "@/types";

export default function SolvePage() {
  const params = useParams<{ questionId: string }>();
  const router = useRouter();
  const [question, setQuestion] = useState<Question | null>(null);
  const [history, setHistory] = useState<Attempt[]>([]);
  const [answer, setAnswer] = useState("");
  const [seconds, setSeconds] = useState(0);
  const [timing, setTiming] = useState(true);
  const [recordTime, setRecordTime] = useState(true);
  const [result, setResult] = useState<AttemptCreated | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [editNumber, setEditNumber] = useState("");
  const [editAnswer, setEditAnswer] = useState("");
  const [editDifficulty, setEditDifficulty] = useState("");

  async function load() {
    const [item, attempts] = await Promise.all([
      api<Question>(`/questions/${params.questionId}`),
      api<Page<Attempt>>(`/attempts?question_id=${params.questionId}&size=100`),
    ]);
    setQuestion(item);
    setHistory(attempts.items);
    setEditNumber(item.display_number);
    setEditAnswer(item.correct_answer);
    setEditDifficulty(item.publisher_difficulty ?? "");
    document.title = `تست ${item.display_number} | TSP`;
  }

  useEffect(() => {
    setLoading(true);
    load()
      .catch((err: unknown) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.questionId]);

  useEffect(() => {
    if (!timing) return;
    const id = window.setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(id);
  }, [timing]);

  async function submit(userAnswer: string | null) {
    if (!question) return;
    setPending(true);
    setError(null);
    try {
      const created = await api<AttemptCreated>("/attempts", {
        method: "POST",
        body: JSON.stringify({
          question_id: question.id,
          user_answer: userAnswer,
          spent_seconds: recordTime ? seconds : null,
          source: "manual",
        }),
      });
      setResult(created);
      setAnswer("");
      setSeconds(0);
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!answer.trim()) {
      setError("پاسخ را وارد کنید، یا دکمه بی‌پاسخ را بزنید.");
      return;
    }
    await submit(answer.trim());
  }

  async function toggleFlag(field: "is_important" | "is_hard") {
    if (!question) return;
    try {
      const updated = await api<Question>(`/questions/${question.id}`, {
        method: "PATCH",
        body: JSON.stringify({ [field]: !question[field] }),
      });
      setQuestion(updated);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function saveKey(event: FormEvent) {
    event.preventDefault();
    if (!question) return;
    setPending(true);
    try {
      const updated = await api<Question>(`/questions/${question.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          display_number: editNumber.trim(),
          correct_answer: editAnswer.trim(),
          publisher_difficulty: editDifficulty.trim() || null,
        }),
      });
      setQuestion(updated);
      setError(null);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  async function archiveQuestion() {
    if (!question) return;
    if (!window.confirm("این تست آرشیو شود؟ تلاش‌های قبلی باقی می‌مانند.")) return;
    try {
      await api(`/questions/${question.id}`, { method: "PATCH", body: JSON.stringify({ is_active: false }) });
      router.push(`/books/${question.book_id}`);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  if (loading) return <Spinner />;
  if (!question) return <Alert>{error || "تست پیدا نشد."}</Alert>;

  const clock = `${toFaDigits(String(Math.floor(seconds / 60)).padStart(2, "0"))}:${toFaDigits(String(seconds % 60).padStart(2, "0"))}`;

  return (
    <div>
      <PageHeader
        eyebrow={question.book_title || "بانک تست"}
        title={`تست ${question.display_number}`}
        description={question.path.map((node) => `${NODE_TYPE_LABELS[node.node_type]} ${node.title}`).join(" / ") || question.node_title || ""}
        action={
          <Link href={`/books/${question.book_id}`} className="inline-flex h-11 items-center rounded-xl border border-line bg-white px-4 text-sm font-semibold">
            بازگشت به کتاب
          </Link>
        }
      />
      <p className="mb-4 text-xs text-muted">شناسه داخلی {shortId(question.id)} · این شماره نمایشی یکتا نیست.</p>
      {error ? <div className="mb-4"><Alert>{error}</Alert></div> : null}
      {!question.is_active ? (
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Alert tone="info">این تست آرشیو شده و قابل حل نیست. تاریخچه باقی است.</Alert>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              void api<Question>(`/questions/${question.id}`, { method: "PATCH", body: JSON.stringify({ is_active: true }) })
                .then(setQuestion)
                .catch((err: unknown) => setError(errorMessage(err)));
            }}
          >
            بازگردانی
          </Button>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <form onSubmit={onSubmit} className="panel space-y-4 p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-extrabold">پاسخ شما</h2>
            <button type="button" className="text-sm font-semibold text-pine" onClick={() => setShowKey((value) => !value)}>
              {showKey ? "پنهان کردن کلید" : "نمایش کلید"}
            </button>
          </div>
          {showKey ? <Alert tone="info">پاسخ صحیح: {question.correct_answer}</Alert> : null}
          <Field label="گزینه یا پاسخ">
            <TextInput
              value={answer}
              onChange={(event) => setAnswer(event.target.value)}
              placeholder="مثلاً ۳"
              autoFocus
              className="h-14 text-lg"
            />
          </Field>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-foam px-3 py-3 text-sm">
            <span className="font-bold tabular-nums">{clock}</span>
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" className="font-semibold text-pine" onClick={() => setTiming((value) => !value)}>
                {timing ? "توقف زمان" : "ادامه زمان"}
              </button>
              <label className="flex items-center gap-2 text-muted">
                <input type="checkbox" checked={recordTime} onChange={(event) => setRecordTime(event.target.checked)} />
                ثبت زمان
              </label>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={pending || !question.is_active}>{pending ? "در حال ثبت..." : "ثبت پاسخ"}</Button>
            <Button type="button" variant="secondary" disabled={pending || !question.is_active} onClick={() => void submit(null)}>
              بی‌پاسخ
            </Button>
            <Button type="button" variant="ghost" onClick={() => void toggleFlag("is_important")}>
              {question.is_important ? "برداشتن مهم" : "علامت مهم"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => void toggleFlag("is_hard")}>
              {question.is_hard ? "برداشتن سخت" : "علامت سخت"}
            </Button>
          </div>
          <p className="text-xs leading-6 text-muted">این حل یک رکورد جدید می‌سازد. تلاش قبلی عوض نمی‌شود.</p>
        </form>

        <section className="panel p-5">
          <h2 className="text-lg font-extrabold">نتیجه</h2>
          {!result ? (
            <p className="mt-6 text-sm leading-7 text-muted">بعد از ثبت پاسخ، درست، غلط یا بی‌پاسخ و درصد همین‌جا دیده می‌شود.</p>
          ) : (
            <div className="mt-4 space-y-5">
              <div className="flex items-center justify-between gap-4">
                <span className={`stamp ${result.result === "correct" ? "text-good" : result.result === "wrong" ? "text-bad" : "text-warn"}`}>
                  {RESULT_LABELS[result.result]}
                </span>
                <div className="text-sm leading-7">
                  <p>پاسخ شما: <b>{result.user_answer || "—"}</b></p>
                  <p>پاسخ صحیح: <b>{result.correct_answer}</b></p>
                  <p>تلاش شماره {formatCount(result.attempt_index || history.length)}</p>
                </div>
              </div>
              <StatBlock title="این تست" stats={result.question} />
              <StatBlock title="این کتاب" stats={result.book} />
              <StatBlock title="کل تلاش‌ها" stats={result.overall} />
              <p className="text-xs leading-6 text-muted">{PERCENT_NOTE}</p>
            </div>
          )}
        </section>
      </div>

      <section className="panel mt-4 p-5">
        <h2 className="text-lg font-extrabold">تاریخچه این تست</h2>
        <p className="mt-1 text-xs text-muted">هر ردیف یک حل مستقل است و بازنویسی نمی‌شود.</p>
        {history.length === 0 ? (
          <p className="mt-6 text-sm text-muted">هنوز تلاشی ثبت نشده.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[40rem] text-sm">
              <thead className="text-xs text-muted">
                <tr className="border-b border-line">
                  <th className="px-2 py-2 text-right font-medium">تلاش</th>
                  <th className="px-2 py-2 text-right font-medium">پاسخ</th>
                  <th className="px-2 py-2 text-right font-medium">نتیجه</th>
                  <th className="px-2 py-2 text-right font-medium">زمان</th>
                  <th className="px-2 py-2 text-right font-medium">تاریخ</th>
                  <th className="px-2 py-2 text-right font-medium">منبع</th>
                </tr>
              </thead>
              <tbody>
                {history.map((item) => (
                  <tr key={item.id} className="border-b border-line/70">
                    <td className="px-2 py-3 font-bold">{formatCount(item.attempt_index || 0)}</td>
                    <td className="px-2 py-3">{item.user_answer || "—"}</td>
                    <td className="px-2 py-3"><ResultBadge result={item.result} /></td>
                    <td className="px-2 py-3">{formatSeconds(item.spent_seconds)}</td>
                    <td className="px-2 py-3">{formatJalali(item.attempted_at)}</td>
                    <td className="px-2 py-3">{SOURCE_LABELS[item.source]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <details className="panel mt-4 p-5">
        <summary className="cursor-pointer font-extrabold">ویرایش کلید و آرشیو</summary>
        <p className="mt-2 text-xs leading-6 text-muted">تغییر پاسخ صحیح، نتیجه تلاش‌های قبلی را عوض نمی‌کند.</p>
        <form onSubmit={saveKey} className="mt-4 grid gap-3 sm:grid-cols-3">
          <Field label="شماره نمایشی">
            <TextInput value={editNumber} onChange={(event) => setEditNumber(event.target.value)} />
          </Field>
          <Field label="پاسخ صحیح">
            <TextInput value={editAnswer} onChange={(event) => setEditAnswer(event.target.value)} />
          </Field>
          <Field label="سختی ناشر">
            <TextInput value={editDifficulty} onChange={(event) => setEditDifficulty(event.target.value)} />
          </Field>
          <div className="flex gap-2 sm:col-span-3">
            <Button type="submit" variant="secondary" disabled={pending}>ذخیره کلید</Button>
            <Button type="button" variant="danger" onClick={() => void archiveQuestion()}>آرشیو تست</Button>
          </div>
        </form>
      </details>
    </div>
  );
}

function StatBlock({ title, stats }: { title: string; stats: Stats }) {
  return (
    <PercentBar
      label={title}
      value={stats.percentage}
      detail={`${formatCount(stats.correct)} درست · ${formatCount(stats.wrong)} غلط · ${formatCount(stats.unanswered)} بی‌پاسخ از ${formatCount(stats.total)}`}
    />
  );
}
