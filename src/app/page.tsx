import { Suspense } from 'react'
import Link from 'next/link'
import { HomeFeed } from '@/components/home-feed'
import { HomeCta } from '@/components/home-cta'
import { HtmlClass } from '@/components/html-class'
import { ExploreLink } from '@/components/explore-gate'
import { GeneralInquiryButton } from '@/components/general-inquiry-button'
import { PRE_LAUNCH } from '@/lib/pre-launch'
import { WorksTeaser } from '@/components/works-teaser'
import { listRecentWorks } from '@/lib/public-designers'
import { listActivePopups } from '@/lib/popups-db'
import { SitePopups } from '@/components/site-popup'
import { DEFAULT_DESIGN_PRICE } from '@/lib/plans'
import styles from '@/components/home.module.css'

// 홈에서는 대표 작업을 크게 보여주고, 전체 목록은 탐색 화면으로 연결한다.
const FEED_LIMIT = 4

export default function Home() {
  return (
    <main className={styles.home}>
      <HtmlClass names={['smooth-anchor']} />
      <Hero />
      <section id="works" className={`${styles.shell} ${styles.works}`} aria-labelledby="works-title">
        <div className={styles.sectionHead}>
          <div>
            <p className={styles.eyebrow}>SELECTED WORK</p>
            <h2 id="works-title">말보다 선명한 결과.</h2>
          </div>
          <ExploreLink className={styles.textLink}>디자이너 둘러보기 <span aria-hidden="true">↗</span></ExploreLink>
        </div>
        {PRE_LAUNCH ? <WorksTeaser /> : (
          <Suspense fallback={<FeedSkeleton />}><Feed /></Suspense>
        )}
      </section>
      <Services />
      <HomeCta price={DEFAULT_DESIGN_PRICE} />
      <Suspense fallback={null}><Popups /></Suspense>
    </main>
  )
}

function Hero() {
  return (
    <section className={styles.hero} aria-labelledby="home-title">
      <div className={`${styles.shell} ${styles.heroInner}`}>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}><span className={styles.dot} /> DESIGN, BUILT FOR BUSINESS</p>
          <h1 id="home-title">비즈니스의 차이,<br />디자인에서 시작.</h1>
          <p className={styles.heroDescription}>
            전문 디자이너의 감각에 개발자의 기술을 더합니다.<br />당신의 브랜드에 꼭 맞는, SOOM.
          </p>
          <a href="#works" className={styles.heroLink}>
            <span className={styles.roundArrow} aria-hidden="true">↓</span>작업 먼저 보기
          </a>
        </div>
        <div className={styles.heroArt} aria-hidden="true">
          {/* SOOM을 위한 벡터 그래픽. 외부 이미지 요청 없이 첫 화면에 표시한다. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/soom-sculpture.svg" alt="" width="680" height="680" fetchPriority="high" />
        </div>
        <div className={styles.heroFoot}>
          <span>디자인의 감각. 기술의 완성도.</span>
          <span>BRANDING <i /> WEB DESIGN <i /> DEVELOPMENT</span>
        </div>
      </div>
    </section>
  )
}

function Services() {
  return (
    <section className={`${styles.shell} ${styles.services}`} aria-labelledby="services-title">
      <div className={styles.servicesIntro}>
        <p className={styles.eyebrow}>THE SOOM WAY</p>
        <h2 id="services-title">AI의 속도에,<br />전문가의 깊이를.</h2>
        <p>AI로 빠르게 시작하고, 디자이너가 세밀하게 다듬고, 개발자가 코드까지 검수합니다.</p>
        <Link href="/about" className={styles.textLink}>SOOM 알아보기 <span aria-hidden="true">↗</span></Link>
      </div>
      <div className={styles.serviceList}>
        <details className={styles.service} open>
          <summary><span className={styles.serviceNumber}>01</span><h3>웹사이트 제작</h3><span className={styles.plus} aria-hidden="true" /></summary>
          <div className={styles.serviceBody}>
            <div className={styles.planHeading}>
              <span>실속형</span>
              <div><strong>39만 원</strong><span>고정 · VAT 별도</span></div>
            </div>
            <p className={styles.designerNote}><span className={styles.dot} /> 전문 디자이너가 직접 디자인합니다.</p>
            <dl className={styles.planDetails}>
              <div><dt>규모</dt><dd>최대 5페이지 · 메인 최대 8섹션</dd></div>
              <div><dt>수정</dt><dd>최대 3회</dd></div>
              <div><dt>기능</dt><dd>문의 폼 · 이메일 연동 · 지도</dd></div>
            </dl>
            <p className={styles.planExclusions}>회원·예약 · 콘텐츠 관리 · 관리자 페이지 미포함</p>
            <div className={styles.premiumNote}>
              <div><span>더 많은 기능이 필요하다면</span><strong>프리미엄 250만 원부터</strong></div>
              <p>회원 · 예약 · 콘텐츠 · 관리자 페이지<br />규모에 맞춘 견적 · VAT 별도</p>
            </div>
            <GeneralInquiryButton className={styles.textLink}>웹사이트 제작 문의 <span aria-hidden="true">↗</span></GeneralInquiryButton>
          </div>
        </details>
        <details className={styles.service}>
          <summary><span className={styles.serviceNumber}>02</span><h3>브랜드 & 디지털 디자인</h3><span className={styles.plus} aria-hidden="true" /></summary>
          <div className={styles.serviceBody}>
            <p>로고부터 UI·UX까지. 포트폴리오를 살펴보고, 브랜드에 맞는 디자이너를 직접 선택하세요.</p>
            <ExploreLink className={styles.textLink}>내게 맞는 디자이너 찾기 <span aria-hidden="true">↗</span></ExploreLink>
          </div>
        </details>
        <details className={styles.service}>
          <summary><span className={styles.serviceNumber}>03</span><h3>맞춤 서비스 개발</h3><span className={styles.plus} aria-hidden="true" /></summary>
          <div className={styles.serviceBody}>
            <p>기능 중심 MVP부터 복잡한 웹 서비스까지. 비즈니스를 전공한 리드 개발자가 설계와 코드 품질을 함께 살핍니다.</p>
            <a href="https://agency.soom.it" target="_blank" rel="noopener noreferrer" className={styles.textLink}>개발 프로젝트 살펴보기 <span aria-hidden="true">↗</span></a>
          </div>
        </details>
      </div>
    </section>
  )
}

async function Feed() {
  const works = await listRecentWorks(FEED_LIMIT)
  return <HomeFeed works={works} />
}

function FeedSkeleton() {
  return (
    <div className={styles.workGrid} role="status" aria-label="작업을 불러오는 중">
      {Array.from({ length: FEED_LIMIT }, (_, i) => (
        <div key={i} className={styles.workSkeleton} aria-hidden="true"><div /><span /></div>
      ))}
    </div>
  )
}

async function Popups() {
  const popups = await listActivePopups()
  return popups.length > 0 ? <SitePopups popups={popups} /> : null
}
