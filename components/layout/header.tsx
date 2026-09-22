import { formatJalali } from "@/lib/date";

import { UserMenu } from "./user-menu";

/** نوار بالایی صفحه‌های داخلی: سلام به کاربر، تاریخ امروز و منوی کاربر. */
export function Header({ user }: { user: { name: string; email: string } }) {
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b border-slate-200 bg-white/95 px-4 backdrop-blur lg:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-[10px] font-bold text-white lg:hidden">
          TSP
        </span>

        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-900">خوش آمدی، {user.name}</p>
          <p className="hidden truncate text-xs text-slate-400 sm:block">
            امروز {formatJalali(new Date(), { long: true, withWeekday: true })}
          </p>
        </div>
      </div>

      <UserMenu name={user.name} email={user.email} />
    </header>
  );
}
