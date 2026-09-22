import { apiOk, handleApiError, readJsonBody, requireApiUser } from "@/lib/api";
import { deleteBook, getBookDetail, updateBook } from "@/lib/services/books";
import { bookSchema } from "@/lib/validations";

/**
 * یک کتاب — `/api/books/[id]`
 *
 *  • `GET`    جزئیات کتاب + گره‌های ساختار + آمار.
 *  • `PATCH`  ویرایش ویژگی‌های کتاب.
 *  • `DELETE` حذف کتاب همراه ساختار و تست‌هایش (Cascade).
 */

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteContext) {
  const { user, response } = await requireApiUser();

  if (!user) {
    return response;
  }

  try {
    const { id } = await params;
    const detail = await getBookDetail(id, user.id);

    return apiOk(detail);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const { user, response } = await requireApiUser();

  if (!user) {
    return response;
  }

  try {
    const { id } = await params;
    const parsed = bookSchema.safeParse(await readJsonBody(request));

    if (!parsed.success) {
      return handleApiError(parsed.error);
    }

    const book = await updateBook(id, user.id, parsed.data);

    return apiOk(book);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const { user, response } = await requireApiUser();

  if (!user) {
    return response;
  }

  try {
    const { id } = await params;
    const result = await deleteBook(id, user.id);

    return apiOk(result);
  } catch (error) {
    return handleApiError(error);
  }
}
