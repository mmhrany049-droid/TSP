import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, BookOpen, ListChecks, RotateCcw } from "lucide-react";

import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { APP_TITLE, APP_VERSION } from "@/lib/constants";
import { formatJalali, jalaliToday } from "@/lib/date";

export const metadata: Metadata = { title: "داشبورد" };

/**
 * صفحهٔ نخست.
 *
 * در این مرحله فقط زیرساخت ساخته شده است؛ این صفحه وضعیت پروژه را نشان می‌دهد و
 * در پرامپت بعدی با آمار واقعی (درصد کلی، مبحث‌ها، عقب‌ماندگی) جایگزین می‌شود.
 */
export default function DashboardPage() {
  const steps = [
    {
      href: "/books",
      title: "کتاب‌ها و ساختار",
      description: "یک کتاب تعریف کنید و فصل و بخش‌هایش را بسازید.",
      icon: BookOpen,
    },
    {
      href: "/questions",
      title: "بانک تست",
      description: "تست‌ها را با شمارهٔ نمایشی و پاسخ صحیح وارد کنید.",
      icon: ListChecks,
    },
    {
      href: "/attempts",
      title: "ثبت تلاش",
      description: "هر بار حل تست را ثبت کنید تا تاریخچه ساخته شود.",
      icon: RotateCcw,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-xl font-semibold text-slate-900">{APP_TITLE}</h1>
        <p className="text-sm text-slate-500">
          نسخهٔ <span className="numeric font-medium text-slate-700">{APP_VERSION}</span> — امروز{" "}
          <span className="font-medium text-slate-700">{formatJalali(new Date(), { long: true, withWeekday: true })}</span>{" "}
          <span className="text-slate-400">({jalaliToday({ persianDigits: false })})</span>
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>زیرساخت این نسخه آماده است</CardTitle>
        </CardHeader>
        <CardBody className="space-y-3 text-sm text-slate-600">
          <p>
            در این مرحله ساختار پروژه، مدل دادهٔ Prisma، اتصال پایگاه داده، قالب فارسی/راست‌به‌چپ و
            ابزارهای پایه (تاریخ شمسی، اعتبارسنجی و رابط کاربری) ساخته شده است.
          </p>
          <p>
            صفحه‌های زیر در مراحل بعدی کامل می‌شوند؛ فعلاً برای دیدن ساختار پروژه می‌توانید به آن‌ها
            سر بزنید.
          </p>
        </CardBody>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        {steps.map((step) => {
          const Icon = step.icon;

          return (
            <Link key={step.href} href={step.href} className="group">
              <Card className="h-full transition-colors group-hover:border-slate-300">
                <CardBody className="space-y-3">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <p className="flex items-center gap-1 font-medium text-slate-900">
                    {step.title}
                    <ArrowLeft className="size-4 text-slate-400 transition-transform group-hover:-translate-x-0.5" aria-hidden />
                  </p>
                  <p className="text-sm text-slate-500">{step.description}</p>
                </CardBody>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
