import { dirname } from "path";
import { fileURLToPath } from "url";

import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });

/** فایل‌ها و پوشه‌هایی که بررسی نمی‌شوند. */
const IGNORED = [
  "node_modules/**",
  ".next/**",
  "out/**",
  "build/**",
  "next-env.d.ts",
  // پروژهٔ نسخهٔ ۰.۱ (پایتون) بایگانی شده است
  "legacy/**",
  // فایل‌های ساخته‌شدهٔ Prisma
  "prisma/migrations/**",
];

const eslintConfig = [
  { ignores: IGNORED },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // پارامترها و متغیرهای آغازشده با _ عمداً بی‌استفاده‌اند
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
    },
  },
];

export default eslintConfig;
