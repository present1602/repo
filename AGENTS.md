<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## DB 마이그레이션

- `supabase/migrations/0001_init.sql` 이 기준점이다 — 옛 001 ~ 039 를 하나로 합쳤다(2026-11-02).
- 새 마이그레이션은 **`0002_설명.sql`, `0003_…`** 처럼 네 자리 번호로 이어 쓴다. 옛 세 자리(`0NN_`) 번호는 더 쓰지 않는다.
- 옛 `001_` ~ `039_` 파일은 운영 확인 뒤 지운다 — 고치지도, 다시 돌리지도 않는다.
- 파일은 Supabase SQL Editor 에 붙여 넣어 돌린다. 여러 번 실행해도 안전하게(멱등) 쓴다 — `if not exists`, `drop constraint if exists` 후 `add`, `on conflict do nothing`.
- 새 표는 RLS 를 켜고(`enable` + `force`) 정책을 두지 않는다. 서버만 `service_role` 로 읽고 쓴다.
- 코드가 새 칸을 읽을 때는 마이그레이션 전 DB 에서도 화면이 뜨게 대비한다(`site-settings.ts`·`specialties.ts` 의 빠진 칸 재시도 참고). 에러 문구에는 실행할 파일 이름을 적는다.
