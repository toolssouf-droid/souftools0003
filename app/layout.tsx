import type { Metadata, Viewport } from "next";
import "./globals.css";
import { constructMetadata } from "@/lib/seo";

export const viewport: Viewport = {
  themeColor: "#00d4aa",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = constructMetadata({
  title: "SoufTools — منصة الذكاء الاصطناعي العالمية",
  description: "الجيل القادم من نماذج الذكاء الاصطناعي الفائقة بسرعة استجابة عالية ودعم كامل للغة العربية والبحث الحي في الويب وتوليد الصور",
  path: "/",
  locale: "ar",
  image: "/og-image.png",
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <body className="min-h-screen bg-[#0a0f0f] text-[#e8f5f5] selection:bg-[#00d4aa]/30 selection:text-[#00d4aa] antialiased" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
