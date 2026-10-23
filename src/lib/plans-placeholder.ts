/* ⚠ 임시 하드코딩 — 가격 플랜

   아직 DB에 플랜 테이블이 없어 모든 디자이너에게 같은 값이 보인다.
   디자이너마다 다른 금액을 받으려면 테이블을 만들고 이 모듈을 지운다.

   목업(lib/designers.ts)은 디자이너 index 로 금액을 조금씩 올려 서로 달라
   보이게 했지만, 실제 금액이 아닌데 다르게 보이면 의뢰인이 그대로 믿는다.
   그래서 한 벌만 두고 화면에 안내 문구를 함께 띄운다. */

export type Plan = {
  name: string
  price: string
  items: string[]
  period: string
}

export const PLACEHOLDER_PLANS: [Plan, Plan] = [
  {
    name: '베이직',
    price: '150만원',
    items: ['핵심 화면 5종 디자인', '수정 2회', 'Figma 원본 파일 제공'],
    period: '2주',
  },
  {
    name: '프리미엄',
    price: '400만원',
    items: ['전체 화면 디자인 (최대 20종)', '디자인 시스템 구축', '수정 5회 · 개발 QA 지원'],
    period: '5–6주',
  },
]
