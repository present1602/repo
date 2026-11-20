# balance 모노레포

pnpm 워크스페이스. 서비스는 거의 별개이고 **편의상 한 저장소에 둔다** — 언제든 폴더 하나만
떼어 별도 저장소로 옮길 수 있게 유지한다.

```
apps/
  web/            홈페이지 + /admin (Next 16, Vercel icn1) — 규칙은 apps/web/AGENTS.md
  marketing/      마케팅 대행 서비스 (예정) — 이 폴더만 떼면 그대로 별도 저장소
    console/      마케팅 어드민 (Next)
    worker/       숏폼 생성·렌더·발행 (Node + ffmpeg)
    core/         console·worker 공용 (DB·타입·작업 형식·AI 업체 연동)
```

## 서비스끼리 엮지 않는다

- **서로 import 하지 않는다.** `apps/web` ↔ `apps/marketing` 사이에 코드·타입 공유 없음.
  루트 `packages/` 도 두지 않는다 — 설정 몇십 줄은 서비스마다 중복해 둔다.
- **DB·env·배포를 따로 둔다.** Supabase 프로젝트, `.env.local`, Vercel 프로젝트가 서비스마다 하나씩.
- 서비스 간에 데이터가 필요하면 **HTTP API** 로 주고받는다(저장소가 나뉘어도 그대로 동작하게).

## 명령

- 패키지 매니저는 **pnpm** 만 쓴다(`npm install` 금지 — 락파일이 둘이 되고 워크스페이스가 깨진다).
- 루트에서: `pnpm dev`, `pnpm build`, `pnpm lint` (지금은 web). 특정 서비스는 `pnpm --filter <이름> <스크립트>`.
- 의존성 추가는 서비스에: `pnpm --filter web add <패키지>`. 루트 `package.json` 에는 넣지 않는다.
- `.env.local` 은 각 서비스 폴더에 둔다(`apps/web/.env.local`).
