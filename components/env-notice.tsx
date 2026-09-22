import { CommandLine, Notice, NoticeList } from "@/components/ui/notice";
import { getEnvStatus } from "@/lib/env";

/**
 * کادر راهنمای تنظیمات محیطی.
 *
 * در صفحه‌های ورود/ثبت‌نام نشان داده می‌شود و اگر چیزی در تنظیمات کم باشد
 * (نبود `.env`، نبود `AUTH_SECRET` یا قالب نادرست) کاربر را دقیقاً راهنمایی می‌کند.
 * اگر همه‌چیز درست باشد، هیچ چیزی نمایش داده نمی‌شود.
 */
export function EnvNotice() {
  const status = getEnvStatus();

  if (!status.needsAttention) {
    return null;
  }

  if (status.fatal) {
    return (
      <Notice tone="error" title="کلید امنیتی نشست (AUTH_SECRET) تنظیم نشده است">
        <p>
          برنامه در حالت تولید اجرا می‌شود و برای امنیت نشست‌ها به این کلید نیاز دارد؛ بدون آن
          ورود ممکن نیست.
        </p>
        <p className="text-xs">راه‌حل: در ریشهٔ پروژه فایل ‎.env‎ بسازید و این خط را به آن اضافه کنید:</p>
        <p>
          <CommandLine>AUTH_SECRET=&quot;یک-رشتهٔ-تصادفی-بلند&quot;</CommandLine>
        </p>
        <p className="flex flex-wrap items-center gap-2 text-xs">
          ساخت مقدار تصادفی:
          <CommandLine>npm run init:env -- --force</CommandLine>
        </p>
      </Notice>
    );
  }

  return (
    <Notice tone="warning" title="راهنمای اجرای محلی">
      <NoticeList items={status.messages} />
      <p className="text-xs font-medium">چه کاری انجام دهم؟</p>
      <NoticeList items={status.hints} />
      <p className="text-xs">
        این پیام‌ها فقط در حالت توسعه نمایش داده می‌شوند و پس از تنظیم ‎.env‎ از بین می‌روند.
      </p>
    </Notice>
  );
}
