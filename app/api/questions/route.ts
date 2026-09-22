import { apiError, apiOk, handleApiError, readJsonBody, requireApiUser } from "@/lib/api";
import { createQuestion, getQuestionBankSummary, listQuestions } from "@/lib/services/questions";
import { questionQuerySchema, questionSchema } from "@/lib/validations";

/**
 * بانک تست — `/api/questions`
 *
 *  • `GET`  فهرست تست‌ها با فیلتر (کتاب، بخش، مهم، سخت، سختی ناشر، بایگانی، جست‌وجو)
 *           و صفحه‌بندی + آمار کلی.
 *  • `POST` ثبت تست تازه.
 *
 * فیلترها همیشه به کتاب‌های خود کاربر محدود می‌شوند (در لایهٔ سرویس).
 */

export async function GET(request: Request) {
  const { user, response } = await requireApiUser();

  if (!user) {
    return response;
  }

  try {
    const params = Object.fromEntries(new URL(request.url).searchParams.entries());
    const parsed = questionQuerySchema.safeParse(params);

    if (!parsed.success) {
      return apiError("فیلترهای ارسالی معتبر نیستند.", 400);
    }

    const query = parsed.data;

    const [list, summary] = await Promise.all([
      listQuestions(user.id, {
        bookId: query.bookId,
        bookNodeId: query.bookNodeId,
        includeInactive: query.inactive === "true",
        important: query.important ? query.important === "true" : undefined,
        hard: query.hard ? query.hard === "true" : undefined,
        publisherDifficulty: query.publisherDifficulty,
        search: query.search,
        page: query.page,
        perPage: query.perPage,
      }),
      getQuestionBankSummary(user.id),
    ]);

    return apiOk({ ...list, summary });
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
    const parsed = questionSchema.safeParse(await readJsonBody(request));

    if (!parsed.success) {
      return handleApiError(parsed.error);
    }

    const question = await createQuestion(user.id, parsed.data);

    return apiOk(question, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
