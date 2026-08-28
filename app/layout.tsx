import type { Metadata } from "next";
import { Manrope, Onest } from "next/font/google";
import "./globals.css";

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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
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
