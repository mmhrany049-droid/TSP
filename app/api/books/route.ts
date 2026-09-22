import { apiOk, handleApiError, readJsonBody, requireApiUser } from "@/lib/api";
import { createBook, getLibrarySummary, listBooks } from "@/lib/services/books";
import { bookSchema } from "@/lib/validations";

/**
 * کتاب‌ها — `/api/books`
 *
 *  • `GET`  فهرست کتاب‌های کاربر همراه تعداد گره‌ها و تست‌ها + آمار کلی کتابخانه.
 *  • `POST` ساخت کتاب تازه.
 *
 * همهٔ پاسخ‌ها در قالب مشترک `ApiResult` هستند.
 */

export async function GET() {
  const { user, response } = await requireApiUser();

  if (!user) {
    return response;
  }

  try {
    const [books, summary] = await Promise.all([listBooks(user.id), getLibrarySummary(user.id)]);

    return apiOk({ books, summary });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  const { user, response } = await requireApiUser();

  if (!user) {
    return response;
  }

  try {
    const parsed = bookSchema.safeParse(await readJsonBody(request));

    if (!parsed.success) {
      return handleApiError(parsed.error);
    }

    const book = await createBook(user.id, parsed.data);

    return apiOk(book, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
