import 'server-only'
import { supabaseAdmin } from './supabase-admin'
import { FALLBACK_COPY, type PlanCopy } from './plans'

/* 사이트 전역 설정 — 지금은 플랜 이름·설명만 들어 있다.
   site_settings 는 한 줄짜리 테이블이다(id = true). */

export async function getPlanCopy(): Promise<PlanCopy> {
  if (!supabaseAdmin) return FALLBACK_COPY

  const { data, error } = await supabaseAdmin
    .from('site_settings')
    .select('design_plan_name, design_plan_desc, premium_plan_name, premium_plan_desc')
    .eq('id', true)
    .maybeSingle()

  if (error) {
    /* 마이그레이션 전이거나 조회 실패 — 화면이 비는 것보다 기본 문구가 낫다 */
    console.error('[settings] 플랜 문구 조회 실패:', error.message)
    return FALLBACK_COPY
  }

  return (data as PlanCopy) ?? FALLBACK_COPY
}
