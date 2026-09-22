import { apiOk, handleApiError, readJsonBody, requireApiUser } from "@/lib/api";
import { createBookNode, listBookNodes } from "@/lib/services/books";
import { bookNodeSchema } from "@/lib/validations";

/**
 * ساختار کتاب — `/api/books/[id]/nodes`
 *
 *  • `GET`  فهرست گره‌های کتاب (فصل، بخش، زیربخش و …).
 *  • `POST` افزودن گره تازه؛ اگر `parentId` بدهید، زیرمجموعهٔ آن گره ساخته می‌شود.
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
    const nodes = await listBookNodes(id, user.id);

    return apiOk({ nodes });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request, { params }: RouteContext) {
  const { user, response } = await requireApiUser();

  if (!user) {
    return response;
  }

  try {
    const { id } = await params;
    const parsed = bookNodeSchema.safeParse(await readJsonBody(request));

    if (!parsed.success) {
      return handleApiError(parsed.error);
    }

    const node = await createBookNode(id, user.id, parsed.data);

    return apiOk(node, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
