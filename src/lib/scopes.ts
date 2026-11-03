/* 디자이너가 받을 의뢰 유형(017_designer_scopes.sql).

   클라이언트 컴포넌트도 쓰므로 server-only 모듈에 두지 않는다.

   의뢰 폼의 유형(inquiry-types.ts)과 같은 갈래지만 다른 값이다 —
   저쪽은 고객이 고른 것을 글자로 저장하고, 여기는 디자이너가 켜고 끄는
   스위치다. 하나로 합치면 고객 문구를 바꿀 때 디자이너 설정이 깨진다. */

export const SCOPES = ['sample', 'logo', 'full_design', 'with_dev'] as const
export type Scope = (typeof SCOPES)[number]

export function isScope(v: string): v is Scope {
  return (SCOPES as readonly string[]).includes(v)
}

export const SCOPE_LABELS: Record<Scope, string> = {
  sample: '메인 시안 우선',
  logo: '로고 디자인',
  full_design: '디자인 의뢰',
  with_dev: '프로젝트 의뢰',
}

export const SCOPE_HINTS: Record<Scope, string> = {
  sample: '메인화면 시안만 먼저 의뢰합니다.',
  logo: '로고 디자인만 따로 맡깁니다.',
  full_design: '서비스 전체 디자인을 맡깁니다.',
  with_dev:
    '기획, 개발까지 포함한 프로젝트 전체 의뢰를 맡깁니다.',
}

/* 이 디자이너가 그 유형을 받는지.

   메인 시안은 어드민만 켜고 끈다(0004). 디자인·프로젝트는 디자이너 본인이 켠다. */
export function acceptsScope(
  d: {
    scope_sample: boolean
    scope_logo?: boolean
    scope_full_design: boolean
    scope_with_dev: boolean
  },
  scope: Scope,
): boolean {
  if (scope === 'sample') return d.scope_sample
  /* 로고는 분야('로고/일러스트' 등)가 맡는다. 칸(scope_logo)은 남겨 둔다.
     디자인은 거친 판단이다 — 로고·랜딩처럼 범위가 정해진 분야는 스위치 없이 받는다.
     '고객이 선택' 분야(web/app)에서 받는지는 acceptsDesign 이 본다(inquiry-choices.ts) */
  if (scope === 'logo') return false
  if (scope === 'full_design') return true
  return d.scope_with_dev
}

/* '고객이 선택' 분야(web/app)에서 디자인 의뢰를 받는지(0004_plan_options_by_category.sql).

   디자인·프로젝트 중 하나는 켜져 있어야 한다 — 둘 다 꺼진 값(0004 전 DB, 어드민이
   프로젝트만 끈 경우)은 디자인을 받는 것으로 본다. 0004 전에는 디자인을 늘 받았다. */
export function acceptsDesign(d: { scope_full_design: boolean; scope_with_dev: boolean }): boolean {
  return d.scope_full_design || !d.scope_with_dev
}
