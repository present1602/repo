import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Suspense } from "react";
import { SiteNavbar } from "@/components/site-navbar";
import { SiteFooter } from "@/components/site-footer";

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
        {/* 어느 화면인지 알아야 붙일지 정할 수 있다 — 푸터와 같은 방식으로
            Suspense 뒤에 둔다.

            fallback 은 비운다. 같은 높이의 빈 바를 깔면 제안서처럼 바를
            띄우지 않는 화면에서 그 띠가 잠깐 보였다 사라진다 — 바가 있는
            화면에서 한 번 밀리는 편이 덜 눈에 띈다. */}
        <Suspense fallback={null}>
          <SiteNavbar />
        </Suspense>

        <div className="flex flex-1 flex-col">{children}</div>

        {/* 어느 화면인지 알아야 붙일지 정할 수 있다 — 현재 경로는 런타임에만
            알 수 있으므로 Suspense 뒤로 넘겨 정적 셸을 막지 않는다. */}
        <Suspense fallback={null}>
          <SiteFooter />
        </Suspense>
      </body>
    </html>
  );
}
