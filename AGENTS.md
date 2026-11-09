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

## 눌렀는데 아무 일도 안 일어나는 화면을 만들지 않는다

사용자가 버튼을 눌렀으면 **무슨 일이 있었는지 화면에 반드시 보여야 한다.** 서버가
에러를 제대로 돌려줘도 그것이 화면에 안 보이면 사용자에게는 고장난 것과 같다 —
다시 누르거나, 저장됐다고 믿고 창을 닫는다.

- **실패 문구를 띄우는 자리가 지금 눈에 보이는지 확인한다.** 가장 흔한 사고는
  다이얼로그(`fixed inset-0 z-50`) 안에서 저장했는데 알림은 그 **뒤쪽 페이지 본문**에
  그려지는 경우다. 성공 토스트는 `createPortal` 로 body 에 붙어(`z-[60]`) 다이얼로그
  위에 뜨지만, 실패 줄은 `Flash` 가 그 자리에 그대로 그린다(`flash.tsx`) — 다이얼로그
  안에서 저장한다면 **그 다이얼로그 안에도** 실패 줄을 둔다.
- **실패하면 다이얼로그를 닫지 않는다.** 닫아 버리면 적어 둔 내용이 날아가고,
  무엇이 잘못됐는지 읽을 기회도 사라진다.
- **서버 액션의 `{ ok: false, error }` 를 삼키지 않는다.** `if (!r.ok)` 를 빠뜨리거나
  `onMessage` 를 부르지 않고 `return` 하는 길이 하나라도 있으면 그 길이 곧 무반응이다.
- **미리 막을 수 있으면 누르기 전에 막는다.** 형식이 틀린 입력은 저장 버튼을
  비활성화하고 입력칸 옆에 까닭을 적는다(`youtube.ts` 의 `badVideo` 참고) — 파일을
  다 올린 뒤 서버가 거절하면 버킷에 쓰지 않는 파일이 남는다.
- **오래 걸리는 일은 도는 중인 것을 보여준다.** 버튼 글자를 바꾸거나(`올리는 중…`)
  덮개를 씌운다 — 수십 초 걸리는 PDF 변환이 대표적이다(`work-uploader.tsx`).
- 새 칸을 읽다 실패했으면 **돌릴 파일 이름을 문구에 적는다** — 위 마이그레이션 절
  마지막 줄과 같은 방침이다(예: `영상 저장 칸이 없습니다. 0019_work_video.sql 을 실행해 주세요.`).

UI 를 고쳤으면 **브라우저로 직접 확인한다** — 성공뿐 아니라 **실패했을 때 그 문구가
눈에 보이는지**까지 본다. 서버가 에러를 돌려주는 것과 사용자가 그것을 읽는 것은 다른 일이다.
