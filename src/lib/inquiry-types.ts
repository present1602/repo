/* 의뢰 유형(014_inquiry_type.sql, 031_inquiry_type_project.sql, 033_logo_design.sql).

   클라이언트 컴포넌트와 API 라우트가 함께 쓰므로 server-only 모듈에
   두지 않는다. 화면의 라디오, API 검사, DB check 제약이 모두 같은
   글자를 써야 한다 — 한 곳이라도 어긋나면 저장이 조용히 거부된다.

   코드값(design_dev 같은)이 아니라 보이는 글자를 그대로 담는다.
   코드값으로 두면 화면·메일·어드민에서 매번 한글로 옮겨야 하고,
   그 표가 여러 곳에 흩어져 어긋난다. */

import type { PublicDesigner } from './designer-shape'
import {
  DEFAULT_FULL_DESIGN_PRICE,
  DEFAULT_LOGO_PRICE,
  DEFAULT_PROJECT_PRICE,
  formatPrice,
  livePremium,
  type DesignerPremiums,
  type PlanCopies,
} from './plans'
import { acceptsScope, type Scope } from './scopes'

export const INQUIRY_TYPES = ['메인화면 시안 먼저 의뢰', '로고 디자인', '디자인', '프로젝트 의뢰'] as const

export type InquiryType = (typeof INQUIRY_TYPES)[number]

/* 라디오 이름 아래 늘 보이는 한 줄 — 금액처럼 고르기 전에 바로 봐야 하는 것.
   디자이너에게 보내는 폼에서는 그 디자이너의 시작가(offersOf)로 바뀐다. */
export const INQUIRY_TYPE_HINTS: Record<InquiryType, string> = {
  '메인화면 시안 먼저 의뢰': '',
  '로고 디자인': `${formatPrice(DEFAULT_LOGO_PRICE)}~`,
  디자인: `${formatPrice(DEFAULT_FULL_DESIGN_PRICE)}~`,
  '프로젝트 의뢰': `${formatPrice(DEFAULT_PROJECT_PRICE)}~`,
}

/* 할인 전 금액 — 이름 아래 금액 뒤에 사선을 그어 함께 보여준다 */
export const INQUIRY_TYPE_WAS: Partial<Record<InquiryType, string>> = {
  '로고 디자인': '49,000원~',
  디자인: '399,000원~',
  '프로젝트 의뢰': '990,000원~',
}

/* 이름 옆 정보 아이콘을 눌러야 보이는 설명 — 무엇을 맡기는지 풀어 쓴 글 */
export const INQUIRY_TYPE_TIPS: Record<InquiryType, string> = {
  '메인화면 시안 먼저 의뢰': '',
  '로고 디자인': '로고 디자인을 의뢰합니다.',
  디자인:
    '디자인 전체 작업을 의뢰합니다.\n\n메인 시안 우선 의뢰 후 본 계약 진행 시 메인시안을 위해 먼저 지불한 금액을 차감한 나머지 금액만 추가로 지불합니다.\n\n 단, 메인시안을 처음부터 새롭게 만드는 경우에는 전체 본 계약 금액을 지불합니다.',
  '프로젝트 의뢰': '디자인, 개발(+기획) 전체 프로젝트를 의뢰합니다.\n\nSOOM의 개발자가 팀이 되어 개발을 진행합니다.',
}

export function isInquiryType(v: string): v is InquiryType {
  return (INQUIRY_TYPES as readonly string[]).includes(v)
}

/* 의뢰 유형마다 디자이너 쪽 스위치(scopes.ts) — 고객 문구와 디자이너 설정을 잇는다 */
export const INQUIRY_TYPE_SCOPE: Record<InquiryType, Scope> = {
  '메인화면 시안 먼저 의뢰': 'sample',
  '로고 디자인': 'logo',
  디자인: 'full_design',
  '프로젝트 의뢰': 'with_dev',
}

/* 디자이너에게 보내는 폼의 유형과 시작가 — 받지 않는 유형은 빠진다.
   메인 시안·로고는 디자이너가 고른 시작가, 디자인 전체·프로젝트는 어드민이 정한 최소가다.
   premium 은 유형 전체·디자이너별 스위치가 모두 켜졌을 때만 실린다(livePremium). */
export type InquiryOffer = { price: number; premium?: { name: string; price: number } }
export type InquiryOffers = Partial<Record<InquiryType, InquiryOffer>>

/* 프리미엄을 가릴 재료 — 없으면(null) 프리미엄 없이 만든다 */
export type PremiumSource = { copies: PlanCopies; premiums: DesignerPremiums } | null

export function offersOf(
  d: Pick<
    PublicDesigner,
    | 'design_price'
    | 'logo_price'
    | 'full_design_price'
    | 'project_price'
    | 'scope_sample'
    | 'scope_logo'
    | 'scope_full_design'
    | 'scope_with_dev'
  >,
  premium: PremiumSource = null,
): InquiryOffers {
  const price: Record<InquiryType, number> = {
    '메인화면 시안 먼저 의뢰': d.design_price,
    '로고 디자인': d.logo_price,
    디자인: d.full_design_price,
    '프로젝트 의뢰': d.project_price,
  }

  const offers: InquiryOffers = {}
  for (const t of INQUIRY_TYPES) {
    const scope = INQUIRY_TYPE_SCOPE[t]
    if (!acceptsScope(d, scope)) continue

    const live = premium ? livePremium(premium.copies, premium.premiums, scope) : null
    offers[t] = {
      price: price[t],
      ...(live ? { premium: { name: live.name, price: live.price } } : {}),
    }
  }
  return offers
}

/* 문의에 담기는 단계 — 프리미엄을 고를 수 있던 유형에만 값이 있다(036_plan_copy_premium.sql) */
export const PLAN_TIER_LABELS = { basic: '기본', premium: '프리미엄' } as const
export type InquiryPlanTier = keyof typeof PLAN_TIER_LABELS

export function isInquiryPlanTier(v: string): v is InquiryPlanTier {
  return v === 'basic' || v === 'premium'
}
  