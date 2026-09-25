import './globals.css';
import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'تی‌اس‌پی | برنامه‌ریز مطالعه', description: 'مدیریت تست و آمادگی آزمون' };
export default function RootLayout({ children }: Readonly<{children: React.ReactNode}>) { return <html lang="fa" dir="rtl"><body>{children}</body></html>; }
