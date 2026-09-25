"use client";

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="grid min-h-screen place-items-center px-6">
      <div className="panel max-w-md p-8 text-center">
        <h1 className="text-2xl font-extrabold">نمایش صفحه ممکن نشد</h1>
        <p className="mt-2 text-sm leading-7 text-muted">یک خطای غیرمنتظره رخ داد. دوباره تلاش کنید.</p>
        <button type="button" onClick={reset} className="mt-6 h-11 rounded-xl bg-pine px-4 text-sm font-semibold text-white">
          تلاش دوباره
        </button>
      </div>
    </main>
  );
}
