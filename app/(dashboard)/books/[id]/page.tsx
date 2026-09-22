import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { DatabaseNotice } from "@/components/db-notice";
import { BookStructure } from "@/components/library/book-structure";
import { auth } from "@/lib/auth";
import { LOGIN_PATH } from "@/lib/auth.config";
import { getDatabaseStatus } from "@/lib/db-status";
import { getBookDetail } from "@/lib/services/books";
import { NotFoundError } from "@/lib/services/errors";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const session = await auth();
  const { id } = await params;

  if (!session?.user?.id) {
    return { title: "کتاب" };
  }

  try {
    const { book } = await getBookDetail(id, session.user.id);

    return { title: book.title };
  } catch {
    return { title: "کتاب پیدا نشد" };
  }
}

/**
 * ساختار یک کتاب — افزودن، ویرایش، جابه‌جایی و حذف فصل/بخش.
 *
 * اگر شناسهٔ کتاب نامعتبر یا متعلق به کاربر دیگری باشد، صفحهٔ ۴۰۴ فارسی برنامه
 * نمایش داده می‌شود (نه خطای مبهم).
 */
export default async function BookDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect(LOGIN_PATH);
  }

  const database = await getDatabaseStatus();

  if (database.state !== "ready") {
    return <DatabaseNotice />;
  }

  const { id } = await params;

  try {
    const detail = await getBookDetail(id, session.user.id);

    return <BookStructure detail={detail} />;
  } catch (error) {
    if (error instanceof NotFoundError) {
      notFound();
    }

    throw error;
  }
}
