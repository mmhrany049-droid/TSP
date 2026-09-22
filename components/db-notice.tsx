import { CommandLine, Notice, NoticeList } from "@/components/ui/notice";
import { getDatabaseStatus } from "@/lib/db-status";

/**
 * کادر وضعیت پایگاه داده.
 *
 * اگر پایگاه داده ساخته نشده یا ناقص باشد، این کادر در صفحه‌های ورود/ثبت‌نام و
 * داشبورد نمایش داده می‌شود و به‌جای خطای مبهم، دستور دقیق را می‌گوید.
 * وقتی همه‌چیز درست باشد، چیزی نمایش داده نمی‌شود.
 */
export async function DatabaseNotice() {
  const status = await getDatabaseStatus();

  if (status.state === "ready") {
    return null;
  }

  return (
    <Notice tone={status.state === "missing" ? "warning" : "error"} title="پایگاه داده آماده نیست">
      <p>{status.message}</p>

      <NoticeList items={[status.hint]} />

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span>دستورها:</span>
        <CommandLine>npm run db:setup</CommandLine>
        <CommandLine>npm run dev:open</CommandLine>
      </div>

      {status.filePath ? (
        <p className="text-xs opacity-80">
          مسیر فایل پایگاه داده: <span className="numeric" dir="ltr">{status.filePath}</span>
        </p>
      ) : null}
    </Notice>
  );
}
