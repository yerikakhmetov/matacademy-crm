import type { Metadata } from "next";
import { Manrope, Onest } from "next/font/google";
import "./globals.css";
import { getLocale } from "@/lib/locale";
import "katex/dist/katex.min.css"; // набор формул в тестах

const manrope = Manrope({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-manrope",
});
const display = Onest({
  subsets: ["latin", "cyrillic"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
});

export const metadata: Metadata = {
  title: "МатАкадемия CRM",
  description: "CRM для офлайн-школы математики",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // язык документа = язык интерфейса: экранные дикторы и переносы слов в казахском режиме
  const locale = await getLocale();
  return (
    <html lang={locale}>
      <body
        style={
          {
            fontFamily: "var(--font-manrope), system-ui, sans-serif",
          } as React.CSSProperties
        }
        className={`${manrope.variable} ${display.variable}`}
      >
        {children}
      </body>
    </html>
  );
}
