/* 디자이너가 받을 의뢰 유형(017_designer_scopes.sql).

   클라이언트 컴포넌트도 쓰므로 server-only 모듈에 두지 않는다.

   의뢰 폼의 유형(inquiry-types.ts)과 같은 갈래지만 다른 값이다 —
   저쪽은 고객이 고른 것을 글자로 저장하고, 여기는 디자이너가 켜고 끄는
   스위치다. 하나로 합치면 고객 문구를 바꿀 때 디자이너 설정이 깨진다. */

export const SCOPES = ['sample', 'full_design', 'with_dev'] as const
export type Scope = (typeof SCOPES)[number]

export function isScope(v: string): v is Scope {
  return (SCOPES as readonly string[]).includes(v)
}

export const SCOPE_LABELS: Record<Scope, string> = {
  sample: '메인 시안 우선',
  full_design: '디자인 의뢰',
  with_dev: '프로젝트 의뢰',
}

export const SCOPE_HINTS: Record<Scope, string> = {
  sample: '메인화면 시안만 먼저 의뢰합니다.',
  full_design: '서비스 전체 디자인을 맡깁니다.',
  with_dev:
    '기획, 개발까지 포함한 프로젝트 전체 의뢰를 맡깁니다.',
}

/* 이 디자이너가 그 유형을 받는지.

   메인 시안도 본인이 끌 수 있다(019_scope_sample_optional.sql) —
   본계약 건만 받으려는 디자이너가 있다. */
export function acceptsScope(
  d: { scope_sample: boolean; scope_full_design: boolean; scope_with_dev: boolean },
  scope: Scope,
): boolean {
  if (scope === 'sample') return d.scope_sample
  if (scope === 'full_design') return d.scope_full_design
  return d.scope_with_dev
}
