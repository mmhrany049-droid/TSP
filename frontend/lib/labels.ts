import type { AttemptSource, NodeType, Result } from "@/types";

export const NODE_TYPE_LABELS: Record<NodeType, string> = {
  chapter: "فصل",
  section: "بخش",
  subsection: "زیربخش",
  mixed_tests: "تست مخلوط",
  checkup: "آزمون چکاپ",
  comprehensive: "آزمون جامع",
  other: "سایر",
};

export const NODE_TYPES = Object.entries(NODE_TYPE_LABELS) as Array<[NodeType, string]>;

export const RESULT_LABELS: Record<Result, string> = {
  correct: "درست",
  wrong: "غلط",
  unanswered: "بی‌پاسخ",
};

export const SOURCE_LABELS: Record<AttemptSource, string> = {
  manual: "حل دستی",
  review: "مرور",
  exam: "آزمون",
  import: "ورود",
};

export const SUBJECTS = ["شیمی", "فیزیک", "حسابان", "ریاضی", "هندسه", "گسسته", "آمار و احتمال"];
export const GRADES = ["دهم", "یازدهم", "دوازدهم"];
export const DIFFICULTIES = ["آسان", "متوسط", "سخت", "خیلی‌سخت"];

export const PERCENT_NOTE = "درصد = تعداد درست ÷ کل تلاش‌ها × ۱۰۰. غلط و بی‌پاسخ هم در مخرج حساب می‌شوند.";
