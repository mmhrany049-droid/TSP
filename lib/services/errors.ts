/**
 * خطاهای دامنهٔ برنامه.
 *
 * چرا خطای اختصاصی؟ چون لایهٔ سرویس باید بتواند «چیزی که کاربر خواسته پیدا نشد»
 * یا «درخواست نامعتبر است» را از خطای فنی (مثلاً قطع اتصال پایگاه داده) جدا کند.
 * مسیرهای API این خطاها را به کد وضعیت درست و پیام فارسی تبدیل می‌کنند.
 */

/** رکورد خواسته‌شده وجود ندارد یا به کاربر جاری تعلق ندارد. */
export class NotFoundError extends Error {
  constructor(message = "موردی که خواستید پیدا نشد.") {
    super(message);
    this.name = "NotFoundError";
  }
}

/** ورودی درخواست نامعتبر است (بدنهٔ خراب، شناسهٔ نامعتبر و مانند آن). */
export class BadRequestError extends Error {
  constructor(message = "درخواست نامعتبر است.") {
    super(message);
    this.name = "BadRequestError";
  }
}

/** کاری که با وضعیت فعلی داده سازگار نیست (مثلاً گرهٔ والد از کتاب دیگری). */
export class ConflictError extends Error {
  constructor(message = "این کار با وضعیت فعلی داده سازگار نیست.") {
    super(message);
    this.name = "ConflictError";
  }
}
