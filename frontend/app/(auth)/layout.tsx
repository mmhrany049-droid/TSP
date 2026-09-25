export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[1.05fr_0.95fr]">
      <section className="relative hidden overflow-hidden bg-night px-12 py-10 text-[#f6f1e7] lg:flex lg:flex-col lg:justify-between">
        <div>
          <p className="text-sm font-bold tracking-[0.18em] text-[#e4b48a]">TSP</p>
          <p className="mt-2 text-sm text-white/60">سامانه تست، مطالعه و آمادگی</p>
        </div>
        <div>
          <h1 className="max-w-md text-4xl font-extrabold leading-[1.7]">هر تلاش، یک رکورد تازه است.</h1>
          <p className="mt-5 max-w-md text-base leading-8 text-white/75">
            شماره نمایشی تست یکتا نیست. شناسه داخلی یکتاست. سابقه حل هرگز بازنویسی نمی‌شود و درصد از روی همان رکوردهای خام حساب می‌شود.
          </p>
        </div>
        <p className="text-sm text-white/50">متن سؤال ذخیره نمی‌شود. فقط شماره و پاسخ صحیح.</p>
      </section>
      <section className="flex items-center justify-center px-5 py-10">{children}</section>
    </div>
  );
}
