import { Construction } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";

export interface PlaceholderPageProps {
  title: string;
  description: string;
  /** قابلیت‌هایی که در مرحلهٔ بعد ساخته می‌شوند */
  features: string[];
}

/**
 * صفحهٔ موقت ماژول‌ها.
 *
 * این مرحله فقط ساختار پروژه، مدل داده و تنظیمات اولیه را می‌سازد؛ هر صفحه در
 * پرامپت مربوط به خودش کامل می‌شود و تا آن زمان این راهنما نمایش داده می‌شود.
 */
export function PlaceholderPage({ title, description, features }: PlaceholderPageProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
          <Badge tone="warning">
            <Construction className="size-3.5" aria-hidden />
            در دست ساخت
          </Badge>
        </div>
        <p className="text-sm text-slate-500">{description}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>کارهایی که در این صفحه انجام می‌شود</CardTitle>
        </CardHeader>
        <CardBody>
          <ul className="space-y-2 text-sm text-slate-600">
            {features.map((feature) => (
              <li key={feature} className="flex items-start gap-2">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-slate-400" aria-hidden />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>
    </div>
  );
}
