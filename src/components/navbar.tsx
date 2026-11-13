'use client'

import Link from 'next/link'
import { GeneralInquiryButton } from '@/components/general-inquiry-button'
import { ExploreLink } from '@/components/explore-gate'
import { DEFAULT_SITE_MENUS, SITE_MENU_ITEMS, type SiteMenus } from '@/lib/site-menu-shape'
import styles from './site-chrome.module.css'

/* 사이트 공통 바.

   좌측 메뉴는 두지 않는다 — 홈으로 가는 길은 SOOM 로고가 맡고,
   갈 곳은 모두 우측에 모았다. 메뉴가 더 늘면 로고와 우측 묶음 사이에
   nav 를 넣는다.

   차례는 소개 → 탐색 → FAQ → 의뢰하기 다. 색을 채운 단추는 의뢰 하나뿐이라
   오른쪽 끝에 둔다. */
export function Navbar({ menus }: { menus?: Partial<SiteMenus> | null }) {
  // 설정이 전달되지 않거나 일부 항목이 빠져도 기본 메뉴로 표시한다.
  const items = SITE_MENU_ITEMS.map((item) => ({
    ...item,
    ...(menus?.[item.key] ?? DEFAULT_SITE_MENUS[item.key]),
  }))

  return (
    <>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link href="/" className={styles.logo} aria-label="SOOM 홈">soom<span aria-hidden="true">.</span></Link>

          <nav className={styles.nav} aria-label="주 메뉴">
            {items.filter(({ visible }) => visible).map(({ key, href, name }) => {
              const className = styles.navLink
              return key === 'explore' ? (
                <ExploreLink key={key} className={className}>{name}</ExploreLink>
              ) : (
                <Link key={key} href={href} className={className}>{name}</Link>
              )
            })}

          </nav>
          {/* InquiryModal은 portal로 body에 렌더링해 헤더 위에 표시한다. */}
          <div className={styles.headerCta}>
            <GeneralInquiryButton className={styles.inquiryButton}>의뢰하기 <span aria-hidden="true">↗</span></GeneralInquiryButton>
          </div>
        </div>
      </header>

    </>
  )
}
