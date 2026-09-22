import { apiOk, handleApiError, readJsonBody, requireApiUser } from "@/lib/api";
import { deleteBookNode, updateBookNode } from "@/lib/services/books";
import { bookNodeSchema } from "@/lib/validations";

/**
 * یک گرهٔ ساختار کتاب — `/api/books/[id]/nodes/[nodeId]`
 *
 *  • `PATCH`  ویرایش عنوان/نوع/ترتیب، جابه‌جایی نزدیک‌ترین هم‌سطح (`move: up|down`) یا
 *             تغییر والد (`parentId`).
 *  • `DELETE` حذف گره همراه زیرگره‌ها و تست‌هایشان؛ تعداد موارد حذف‌شده برگردانده
 *             می‌شود تا رابط کاربری بتواند پیام دقیق نشان دهد.
 */

interface RouteContext {
  params: Promise<{ id: string; nodeId: string }>;
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const { user, response } = await requireApiUser();

  if (!user) {
    return response;
  }

  try {
    const { nodeId } = await params;
    const body = (await readJsonBody(request)) as Record<string, unknown>;

    // دو حالت پشتیبانی می‌شود: ویرایش کامل گره، یا فقط جابه‌جایی ترتیب.
    if (body.move === "up" || body.move === "down") {
      const node = await updateBookNode(nodeId, user.id, { move: body.move });

      return apiOk(node);
    }

    const parsed = bookNodeSchema.partial().safeParse(body);

    if (!parsed.success) {
      return handleApiError(parsed.error);
    }

    const node = await updateBookNode(nodeId, user.id, parsed.data);

    return apiOk(node);
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
    const { nodeId } = await params;
    const result = await deleteBookNode(nodeId, user.id);

    return apiOk(result);
  } catch (error) {
    return handleApiError(error);
  }
}
