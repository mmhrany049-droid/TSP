import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // نام برنامه در هدرهای پاسخ
  poweredByHeader: false,
  // بسته‌های سنگین سرور نباید در باندل مرورگر قرار بگیرند
  serverExternalPackages: ["@prisma/client", "@libsql/client", "@prisma/adapter-libsql"],
  // در حالت توسعه، اجازهٔ دسترسی از آدرس‌های پیش‌نمایش و شبکه
  allowedDevOrigins: ["localhost", "127.0.0.1", "*.e2b.app", "*.e2b.dev", "*.vercel.app"],
};

export default nextConfig;
