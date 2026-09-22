"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/**
 * پنجرهٔ گفت‌وگو بر پایهٔ عنصر بومی `<dialog>`.
 *
 * چرا بومی؟ چون تمرکز صفحه‌خوان و بستن با کلید Esc و لایهٔ پشت‌زمینه را مرورگر
 * خودش مدیریت می‌کند؛ پس کد ما کوتاه و رفتار قابل‌اعتماد می‌ماند.
 */
export function Dialog({
  open,
  title,
  description,
  onClose,
  children,
  className,
}: {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  // شناسهٔ یکتا: چند پنجره می‌توانند هم‌زمان در صفحه باشند.
  const titleId = useId();

  useEffect(() => {
    const element = dialogRef.current;

    if (!element) {
      return;
    }

    if (open && !element.open) {
      element.showModal();
    } else if (!open && element.open) {
      element.close();
    }
  }, [open]);

  // بستن با Esc یا دکمهٔ پشت‌زمینه، وضعیت والد را هم هم‌گام می‌کند.
  useEffect(() => {
    const element = dialogRef.current;

    if (!element) {
      return;
    }

    const handleClose = () => onClose();

    element.addEventListener("close", handleClose);

    return () => element.removeEventListener("close", handleClose);
  }, [onClose]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      className={cn(
        "w-[min(38rem,calc(100vw-2rem))] rounded-2xl border border-slate-200 bg-white p-0 text-slate-900 shadow-xl",
        "backdrop:bg-slate-900/40",
        className,
      )}
    >
      <header className="flex items-start justify-between gap-4 border-b border-slate-100 p-5">
        <div className="space-y-1">
          <h2 id={titleId} className="text-base font-semibold">
            {title}
          </h2>
          {description ? <p className="text-sm text-slate-500">{description}</p> : null}
        </div>

        <Button variant="ghost" size="icon" onClick={onClose} aria-label="بستن">
          <X className="size-4" aria-hidden />
        </Button>
      </header>

      <div className="max-h-[70vh] overflow-y-auto p-5">{children}</div>
    </dialog>
  );
}
