import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

/**
 * دکمهٔ پایهٔ برنامه.
 *
 * اندازه و رنگ با `variant` و `size` تعیین می‌شود تا در همهٔ صفحه‌ها یکدست بماند.
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-slate-900 text-white hover:bg-slate-800 focus-visible:ring-slate-400",
        secondary: "bg-slate-100 text-slate-800 hover:bg-slate-200 focus-visible:ring-slate-300",
        outline: "border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 focus-visible:ring-slate-300",
        ghost: "text-slate-700 hover:bg-slate-100 focus-visible:ring-slate-300",
        danger: "bg-rose-600 text-white hover:bg-rose-500 focus-visible:ring-rose-300",
      },
      size: {
        sm: "h-9 px-3 text-sm",
        md: "h-10 px-4 text-sm",
        lg: "h-11 px-5 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants>;

export function Button({ className, variant, size, type = "button", ...props }: ButtonProps) {
  return <button type={type} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}

export { buttonVariants };
