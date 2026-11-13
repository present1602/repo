import { GeneralInquiryButton } from './general-inquiry-button'
import { formatPrice } from '@/lib/plans'
import styles from './home.module.css'

export function HomeCta({ price }: { price: number }) {
  return (
    <section className={styles.cta} aria-labelledby="home-cta-title">
      <div className={`${styles.shell} ${styles.ctaInner}`}>
        <p className={styles.eyebrow}>LET’S MAKE A DIFFERENCE</p>
        <div className={styles.ctaRow}>
          <h2 id="home-cta-title">당신의 다음 시작,<br />함께 만들어볼까요?</h2>
          <GeneralInquiryButton className={styles.ctaButton}><span>의뢰하기</span><span aria-hidden="true">↗</span></GeneralInquiryButton>
        </div>
        <div className={styles.ctaFoot}>
          <p>메인 시안 <strong>{formatPrice(price)}부터.</strong> 먼저 확인하고 본 계약을 결정하세요.</p>
          <a href="mailto:manager@soom.it" className={styles.textLink}>manager@soom.it <span aria-hidden="true">↗</span></a>
        </div>
      </div>
    </section>
  )
}
