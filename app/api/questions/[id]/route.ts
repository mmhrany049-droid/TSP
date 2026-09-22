import { apiOk, handleApiError, readJsonBody, requireApiUser } from "@/lib/api";
import { NotFoundError } from "@/lib/services/errors";
import { deleteQuestion, getQuestionDetail, updateQuestion } from "@/lib/services/questions";
import { questionPatchSchema } from "@/lib/validations";

/**
 * یک تست — `/api/questions/[id]`
 *
 *  • `GET`    جزئیات تست همراه کتاب، محل و تعداد تلاش‌ها.
 *  • `PATCH`  ویرایش جزئی: شمارهٔ نمایشی، پاسخ صحیح، سختی ناشر، علامت مهم/سخت،
 *             بایگانی/بازگردانی (`isActive`) و جابه‌جایی محل تست (`bookNodeId`).
 *  • `DELETE` حذف کامل تست؛ در رابط کاربری به‌جای این کار «بایگانی» پیشنهاد می‌شود
 *             تا تاریخچهٔ تلاش‌ها حفظ شود (قاعدهٔ «حذف سخت نداریم»).
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
    const question = await getQuestionDetail(id, user.id);

    if (!question) {
      throw new NotFoundError("تست موردنظر پیدا نشد یا به حساب شما تعلق ندارد.");
    }

    return apiOk(question);
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
    const parsed = questionPatchSchema.safeParse(await readJsonBody(request));

    if (!parsed.success) {
      return handleApiError(parsed.error);
    }

    const question = await updateQuestion(id, user.id, parsed.data);

    return apiOk(question);
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
    const result = await deleteQuestion(id, user.id);

    return apiOk(result);
  } catch (error) {
    return handleApiError(error);
  }
}
