import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PhishGuard AI — 피싱·스미싱 위험도 분석",
  description: "의심스러운 이메일이나 문자를 붙여넣으면 위험도를 분석해드립니다.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="min-h-screen bg-ink-950 text-slate-100 antialiased">
        {children}
      </body>
    </html>
  );
}
