import {
  BookOpen,
  CalendarCheck,
  LayoutDashboard,
  ListChecks,
  NotebookPen,
  RotateCcw,
  Tags,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

/** منوی اصلی برنامه؛ ترتیب آن با ترتیب ماژول‌های سند ۰۲ هم‌خوان است. */
export const NAV_GROUPS: NavGroup[] = [
  {
    title: "نمای کلی",
    items: [
      {
        href: "/",
        label: "داشبورد",
        description: "درصد کلی و وضعیت مطالعه",
        icon: LayoutDashboard,
      },
    ],
  },
  {
    title: "کتاب و تست",
    items: [
      {
        href: "/books",
        label: "کتاب‌ها و ساختار",
        description: "تعریف کتاب، فصل و بخش",
        icon: BookOpen,
      },
      {
        href: "/questions",
        label: "بانک تست",
        description: "ثبت تست و علامت مهم/سخت",
        icon: ListChecks,
      },
      {
        href: "/topics",
        label: "مباحث آموزشی",
        description: "درخت مباحث مستقل از کتاب",
        icon: Tags,
      },
    ],
  },
  {
    title: "تمرین و مرور",
    items: [
      {
        href: "/attempts",
        label: "ثبت و سابقه",
        description: "ثبت تلاش جدید و تست‌های قبلاً حل‌شده",
        icon: NotebookPen,
      },
      {
        href: "/review",
        label: "مرور هوشمند",
        description: "غلط‌ها، نزده‌ها، مهم و سخت",
        icon: RotateCcw,
      },
    ],
  },
  {
    title: "برنامه",
    items: [
      {
        href: "/teaching",
        label: "تدریس و عقب‌ماندگی",
        description: "وضعیت تدریس و هدف تعداد تست",
        icon: CalendarCheck,
      },
      {
        href: "/exams",
        label: "آزمون‌ها",
        description: "تعریف آزمون و ثبت کارنامه",
        icon: ListChecks,
      },
    ],
  },
];
