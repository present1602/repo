import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Suspense } from "react";
import { SiteNavbarData } from "@/components/site-navbar-data";
import { SiteFooter } from "@/components/site-footer";
import { ErrorToaster } from "@/components/error-toast";
import { ChatWidgetData } from "@/components/chat/chat-widget-data";
import { SITE_URL } from "@/lib/site-url";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/* 공유 미리보기(og:image)는 같은 폴더의 opengraph-image.png 를 Next 가 붙인다.
   이미지 주소는 절대 URL 이어야 해서 metadataBase 로 사이트 주소를 준다.

   제목·설명에 한글 "에이전시숨"을 함께 적는다 — 로고는 영문 SOOM 이지만,
   구글은 페이지에 없는 말로는 그 페이지를 찾아주지 않는다. 영문만 적어 두면
   "에이전시숨"으로 검색해도 걸릴 근거가 사이트 어디에도 없다.
   내세우는 이름은 "에이전시숨" 하나로 둔다 — "숨에이전시"를 쓰는 곳이 따로
   있어 제목까지 그 말로 적으면 그쪽과 섞인다. 다만 그렇게 찾아오는 사람도
   있으니 아래 keywords·alternateName 에는 그 꼴도 담아 둔다.

   title.template — 하위 화면이 title 만 적으면 뒤에 브랜드가 자동으로 붙는다.
   default 는 이 레이아웃을 그대로 쓰는 화면(홈)의 제목이다. */
const DESCRIPTION =
  "에이전시숨(SOOM)은 검증된 디자이너를 소액 의뢰로 먼저 만나 보고 본 계약까지 이어가는 디자이너 포트폴리오 플랫폼입니다.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "에이전시숨 (SOOM) · 디자이너 포트폴리오 플랫폼",
    template: "%s · 에이전시숨 (SOOM)",
  },
  description: DESCRIPTION,
  applicationName: "에이전시숨",
  /* 앞부분은 브랜드명을 사람들이 실제로 적어 넣는 꼴들이다 — 한글·영문,
     띄어쓰기, 'it' 을 '아이티·잇'으로 적는 경우까지 함께 담는다. 로고는
     영문 SOOM 하나지만 검색창에는 이 중 아무 꼴로나 들어온다.
     뒷부분은 브랜드를 모르는 사람이 찾을 때 쓰는 일반 말이다. */
  keywords: [
    "에이전시숨",
    "에이전시 숨",
    "숨에이전시",
    "숨 에이전시",
    "숨아이티",
    "숨it",
    "숨잇",
    "soomit",
    "soom.it",
    "SOOM",
    "디자이너 포트폴리오",
    "디자인 의뢰",
    "로고 디자인",
    "디자인 에이전시",
  ],
  /* 같은 화면이 여러 주소로 색인되지 않게 기준 주소를 밝힌다.
     metadataBase 와 합쳐져 절대 URL 이 된다. */
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "ko_KR",
    url: "/",
    siteName: "에이전시숨 (SOOM)",
    title: "에이전시숨 (SOOM) · 디자이너 포트폴리오 플랫폼",
    description: "소액 의뢰로 시작해 본 계약까지.",
  },
  twitter: {
    card: "summary_large_image",
    title: "에이전시숨 (SOOM) · 디자이너 포트폴리오 플랫폼",
    description: "소액 의뢰로 시작해 본 계약까지.",
  },
  /* 검색 노출을 막을 이유가 없는 사이트다 — 기본값에 기대지 않고 명시한다.
     어드민·토큰 주소는 robots.ts 에서 따로 막는다. */
  robots: {
    index: true,
    follow: true,
  },
};

/* 구조화 데이터 — 구글에게 "이 사이트가 어떤 조직인지"를 기계가 읽는 형태로
   준다. name 과 alternateName 을 함께 적어, 어느 꼴로 검색해도 같은 곳을
   가리키는 이름임을 알린다.

   위 keywords 보다 이쪽이 실제로 쓰인다 — meta keywords 는 구글이 오래전에
   무시하기로 한 칸이고, 다른 이름을 알아듣는 자리는 여기다. 그래서 같은
   목록을 양쪽에 둔다.

   <script type="application/ld+json"> 는 실행되는 코드가 아니라 데이터다.
   값이 모두 이 파일에 적힌 고정 문자열이라 바깥 입력이 섞일 자리가 없다. */
const ORG_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "에이전시숨",
  alternateName: [
    "에이전시 숨",
    "숨에이전시",
    "숨 에이전시",
    "숨아이티",
    "숨it",
    "숨잇",
    "SOOM",
    "soomit",
    "soom.it",
  ],
  url: SITE_URL,
  description: DESCRIPTION,
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
          <SiteNavbarData />
        </Suspense>

        <div className="flex flex-1 flex-col">{children}</div>

        {/* 어느 화면인지 알아야 붙일지 정할 수 있다 — 현재 경로는 런타임에만
            알 수 있으므로 Suspense 뒤로 넘겨 정적 셸을 막지 않는다. */}
        <Suspense fallback={null}>
          <SiteFooter />
        </Suspense>

        {/* 우하단 문의 챗봇(0023_chat.sql). 공개 스위치를 켜기 전에는 어드민에게만
            보인다 — 그 판단에 로그인 확인이 필요하므로 Suspense 뒤에 둬서
            모든 화면이 DB 를 기다리지 않게 한다(푸터와 같은 방식). */}
        <Suspense fallback={null}>
          <ChatWidgetData />
        </Suspense>

        {/* 저장 같은 동작이 예외로 실패했을 때 화면을 그대로 두고 위에 알린다(error-toast.tsx) */}
        <ErrorToaster />

        {/* 조직 정보(위 ORG_JSON_LD) — 화면에는 보이지 않고 크롤러만 읽는다 */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(ORG_JSON_LD) }}
        />
      </body>
    </html>
  );
}
