import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center px-6">
      <div className="panel max-w-md p-8 text-center">
        <p className="text-sm font-bold text-pine">۴۰۴</p>
        <h1 className="mt-2 text-2xl font-extrabold">این صفحه پیدا نشد</h1>
        <p className="mt-2 text-sm leading-7 text-muted">مسیر را بررسی کنید یا به داشبورد برگردید.</p>
        <Link href="/" className="mt-6 inline-flex h-11 items-center rounded-xl bg-pine px-4 text-sm font-semibold text-white">
          بازگشت به داشبورد
        </Link>
      </div>
    </main>
  );
}
