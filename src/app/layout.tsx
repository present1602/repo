import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/navbar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "folio",
  description: "디자이너 포트폴리오 플랫폼",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      {/* min-h-screen — 내용이 짧아도 화면 끝까지 늘어난다.
          min-h-full(=100%) 은 부모 높이에 기대므로 내용만큼만 차지해,
          스튜디오 좌측 메뉴 같은 세로 레이아웃이 바닥까지 닿지 못한다. */}
      <body className="flex min-h-screen flex-col bg-neutral-100 text-neutral-900">
        <Navbar />
        <div className="flex flex-1 flex-col">{children}</div>
      </body>
    </html>
  );
}
