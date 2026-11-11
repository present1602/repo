/* 디자이너 세팅 가이드.

   처음 들어온 디자이너가 "무엇부터 어디까지 해야 공개되는지" 를 한 화면에서
   따라갈 수 있게 한다. 글만 두면 어느 버튼인지 못 찾으므로, 실제 화면을
   찍어 단계마다 붙였다(public/guide/*.jpg).

   /studio/guide 한 곳에서만 쓴다. 관리 화면(console.tsx)의 탭(profile·
   portfolio·settings 가 state 를 주고받는 곳)으로 넣지 않고 별도 라우트로
   뒀다 — 안내문은 그 값들과 주고받을 게 없어서, 섞어 두면 둘 다 고치기
   어려워진다. 콘솔 사이드바·모바일 탭줄에는 이 화면으로 가는 Link 한 줄만
   있다. 이 파일이 아는 것은 아래 STEPS 와 그림 파일명뿐이다.

   상태도 훅도 없어 'use client' 가 필요 없다 — 서버에서 그대로 그려진다.

   그림은 next/image 를 쓰지 않는다: 본문 폭에 맞춰 한 가지 크기로만 보이는
   안내 그림이라 최적화 왕복이 득이 없고, 이 프로젝트의 Img 래퍼는 버킷에
   올라간 공개 화면용 그림을 위한 것이다. 대신 loading="lazy" 로 스무 장이
   한꺼번에 받아지지 않게 한다. */

type Step = {
  no: number
  title: string
  lead: string
  /* 본문 — 문단 또는 점 목록 */
  body?: string[]
  bullets?: string[]
  /* 화면 그림(public/guide 기준 파일명)과 그 아래 설명 */
  shots?: { src: string; caption: string }[]
  /* 꼭 짚어야 할 것 — 노란 상자 */
  note?: string
}

const STEPS: Step[] = [
  {
    no: 1,
    title: '프로필부터 채웁니다',
    lead: '로그인하면 바로 보이는 화면입니다. 고객이 가장 먼저 읽는 글이라 여기부터 채웁니다.',
    bullets: [
      '이름은 관리자가 정해 둔 값이라 바꿀 수 없습니다. 바꿔야 하면 관리자에게 문의해 주세요.',
      '한 줄 소개는 탐색 목록에서 이름 아래에 붙는 한 문장입니다. 어떤 작업을 하는지 한눈에 읽히게 적습니다.',
      '소개글은 상세 화면에 문단으로 들어갑니다(2,000자). 줄바꿈을 적은 그대로 보여 줍니다.',
      '프로필 이미지는 자신의 사진, 대표 작품, 캐릭터 이미지 등 자유롭게 설정 가능합니다.',
    ],
    shots: [
      {
        src: 'profile.jpg',
        caption: '처음 상태입니다. 위쪽 ‘프로필 상태’가 숨김으로 되어 있고, 공개 조건이 무엇인지 함께 적혀 있습니다.',
      },
      {
        src: 'profile-filled.jpg',
        caption: '한 줄 소개와 소개글을 채운 모습입니다. 적고 나면 아래 ‘저장’ 버튼이 켜집니다.',
      },
    ],
    note: '내 초대 링크는 이 화면에서 복사할 수 있습니다. 이 링크로 들어온 고객의 의뢰는 바로 나에게 전달됩니다.',
  },
  {
    no: 2,
    title: '작업을 올립니다',
    lead: '포트폴리오 탭에서 ‘작업 추가’를 누르고 파일을 고릅니다. 이미지와 PDF 모두 올릴 수 있습니다.',
    bullets: [
      '파일 하나는 70MB까지, PDF는 30쪽까지 올릴 수 있습니다(고용량 파일은 조금 더 낮은 해상도로 자동 변환되어 저장됩니다).',
      '설명은 어떤 작업인지 적는 자리입니다(1,000자). 클라이언트 이름은 선택입니다.',
      '‘공개 화면에 노출’은 켜진 채로 시작합니다. 끄면 숨긴 채로 저장되고, 나중에 편집에서 다시 켤 수 있습니다.',
    ],
    shots: [
      {
        src: 'portfolio-empty.jpg',
        caption: '작업이 없을 때의 포트폴리오 탭입니다. 오른쪽 위 ‘작업 추가’로 시작합니다.',
      },
      {
        src: 'upload-dialog.jpg',
        caption:
          '파일을 고르면 이 창이 열립니다. 왼쪽에 올릴 그림이, 오른쪽에 적을 칸이 있습니다. 긴 그림은 내려 보며 확인할 수 있습니다.',
      },
    ],
  },
  {
    no: 3,
    title: 'PDF는 이미지로 이미지 파일로 자동 변환되어 올라갑니다.',
    lead: 'PDF를 고르면 장마다 이미지로 바꿔 올립니다. 따로 변환해 둘 필요가 없습니다.',
    bullets: [
      '쪽수가 많으면 수십 초 걸립니다. 바뀌는 동안 진행 상황이 화면에 뜹니다.',
      '30쪽을 이내의 PDF만 올려주세요.',
    ],
    shots: [
      {
        src: 'pdf-converting.jpg',
        caption: 'PDF를 고른 직후입니다. 몇 쪽까지 바꿨는지 보여 주며, 끝날 때까지 기다리면 됩니다.',
      },
      {
        src: 'pdf-converted.jpg',
        caption: '변환이 끝나면 ‘PDF 6쪽’처럼 쪽수가 표시되고, 왼쪽에서 전체를 내려 보며 확인할 수 있습니다.',
      },
    ],
  },
  {
    no: 4,
    title: '썸네일을 정합니다 — 두 가지 방법',
    lead:
      '썸네일은 탐색 목록과 카드에 깔리는 작은 그림입니다. 고객이 내 작업을 누를지 정하는 그림이라, 가장 잘 보이는 자리를 고릅니다.',
    body: [
      '방법은 두 가지입니다. 올린 그림에서 한 부분을 잘라 쓰거나, 썸네일로 쓸 이미지를 따로 올리면 됩니다.',
    ],
    bullets: [
      '영역 지정 — ‘영역 지정’을 누르면 그림 위에 네모가 생깁니다. 모서리를 끌어 크기를, 안쪽을 끌어 자리를 맞춥니다. 오른쪽 미리보기가 바로 따라 바뀝니다.',
      '16:9 · 9:16 · 4:3 · 3:4 · 1:1 을 누르면 그 비율로 고정됩니다. 다시 누르면 풀립니다.',
      '잘못 잡았으면 그림 아래 ‘영역지정 취소’로 되돌립니다.',
      '파일시스템에서 업로드 — 따로 만들어 둔 썸네일이 있으면 이쪽이 빠릅니다. 올리면 잡아 둔 영역 대신 그 파일이 쓰입니다.',
      'PDF는 영역을 잡지 않으면 첫 장이 썸네일이 됩니다.',
    ],
    shots: [
      {
        src: 'crop-mode.jpg',
        caption: '‘영역 지정’을 켠 모습입니다. 그림 위 네모가 썸네일로 쓸 자리이고, 오른쪽에 결과가 바로 비칩니다.',
      },
      {
        src: 'crop-dragged.jpg',
        caption: '아래 모서리를 위로 끌어 윗부분만 잡았습니다. 오른쪽 미리보기도 함께 바뀐 것을 볼 수 있습니다.',
      },
      {
        src: 'crop-ratios.jpg',
        caption: '아래쪽에 비율 버튼이 있습니다. 목록에서 가지런히 보이게 하려면 비율을 고정해 두는 편이 좋습니다.',
      },
      {
        src: 'thumb-upload.jpg',
        caption:
          '‘파일시스템에서 업로드’로 따로 올린 경우입니다. 파일 이름과 ‘빼기’가 보이면 그 파일이 썸네일로 저장됩니다.',
      },
    ],
    note: '썸네일을 정하지 않아도 저장은 됩니다. 다만 긴 그림은 목록에서 알아보기 어려우니 한 번은 잡아 두시길 권합니다.',
  },
  {
    no: 5,
    title: '올린 뒤 고치고, 차례를 바꿉니다',
    lead: '저장한 작업도 언제든 다시 고칠 수 있습니다.',
    bullets: [
      '카드의 ‘편집’을 누르면 설명·클라이언트·썸네일·노출 여부를 그대로 다시 고칠 수 있습니다.',
      '‘포트폴리오 편집’을 누르면 목록이 한 줄씩으로 바뀌고, 왼쪽 손잡이를 끌어 차례를 바꿀 수 있습니다.',
      '여기서 정한 차례가 공개 화면에도 그대로 쓰입니다. 가장 보여주고 싶은 작업을 맨 앞에 둡니다.',
    ],
    shots: [
      {
        src: 'work-saved.jpg',
        caption: '저장하면 카드가 생깁니다. 왼쪽 위 ‘노출’은 지금 공개 화면에 보이는 상태라는 뜻입니다.',
      },
      {
        src: 'reorder.jpg',
        caption: '‘포트폴리오 편집’ 모드입니다. 왼쪽 ⠿ 손잡이를 끌어 차례를 바꿉니다.',
      },
    ],
  },
  {
    no: 6,
    title: '포트폴리오에 외부 웹페이지 링크를 걸 수 있습니다',
    lead:
      '관리자가 허용한 계정만 보이는 기능입니다. 보이지 않으면 관리자에게 요청해 주세요.',
    bullets: [
      '작업의 ‘편집’을 열면 ‘웹사이트 주소’ 칸이 있습니다. 실제로 선보이고 있는 사이트·서비스 주소를 적습니다.',
      '주소만 적고 저장하면 됩니다. https:// 를 빼고 적어도 저장할 때 자동으로 붙습니다.',
      '비우고 저장하면 링크가 떨어집니다. 나중에 사이트가 바뀌거나 내려가면 비워 두세요.',
    ],
    shots: [
      {
        src: 'link-field.jpg',
        caption:
          '작업 편집 창의 ‘웹사이트 주소’ 칸입니다. 적어 두면 상세 화면에 ‘프로젝트 보기’ 버튼이 뜬다고 바로 아래에 안내가 붙습니다.',
      },
      {
        src: 'project-view-button.jpg',
        caption:
          '고객이 보는 상세 페이지(뷰어)입니다. 그림 아래 가운데에 ‘프로젝트 보기 ↗’ 버튼이 뜨고, 누르면 적어 둔 주소가 새 탭으로 열립니다.',
      },
    ],
    note: '시안 단계의 임시 주소보다는, 실제로 열람 가능한 완성된 사이트 주소를 거는 것을 권합니다.',
  },
  {
    no: 7,
    title: '의뢰 유형과 금액을 고릅니다',
    lead:
      '설정 탭입니다. 어떤 분야의 의뢰를 받을지 고르고, 유형마다 금액을 정합니다. 오른쪽에 고객이 볼 화면이 함께 보입니다.',
    bullets: [
      '‘의뢰 받는 분야’에서 받을 분야를 고릅니다. 고른 분야만 아래에서 금액을 설정할 수 있습니다.',
      '고른 분야는 프로필 태그가 되고, 탐색 메뉴와 의뢰 폼에 나옵니다. 태그는 합쳐서 5개까지입니다.',
      '분야마다 디자인 의뢰 · 프로젝트 의뢰 중 받을 것을 체크하고, 시작가를 고릅니다.',
      '플랜 이름과 설명은 모든 디자이너가 함께 쓰는 문구라 바꿀 수 없습니다.',
      '오른쪽 ‘상세 페이지 미리보기’는 고치는 대로 바로 바뀝니다. 고객에게 어떻게 보이는지 여기서 확인하세요.',
    ],
    shots: [
      {
        src: 'settings.jpg',
        caption:
          '왼쪽에서 분야와 금액을 고르면 오른쪽 미리보기가 따라 바뀝니다. 고르지 않은 분야는 흐리게 잠겨 있습니다.',
      },
    ],
  },
  {
    no: 8,
    title: '포함 항목을 적어 둡니다',
    lead:
      '고객이 금액 아래에서 보는 체크 목록입니다. “얼마에 무엇까지 해 주는지”가 여기서 갈리므로, 꼭 채워 두시길 권합니다.',
    bullets: [
      '공통 항목은 모든 의뢰 유형에 들어갑니다. 개별 항목은 그 분야에만 붙습니다.',
      '‘시안 n종’, ‘수정 n회’처럼 숫자가 들어가는 항목은 체크만 하지 말고 숫자까지 넣어야 화면에 나옵니다.',
      '프리미엄이 있는 유형은 STANDARD와 PREMIUM을 따로 체크하고 숫자도 따로 넣을 수 있습니다.',
      '목록에 없는 항목은 맨 아래 ‘직접 입력’으로 추가합니다.',
    ],
    shots: [
      {
        src: 'options.jpg',
        caption: '처음에는 모두 비어 있습니다. 항목마다 STANDARD·PREMIUM 두 칸이 있습니다.',
      },
      {
        src: 'options-filled.jpg',
        caption: '‘시안 n종’에 3, ‘수정 n회’에 2를 넣고 STANDARD를 체크한 모습입니다.',
      },
      {
        src: 'preview-items.jpg',
        caption:
          '오른쪽 미리보기에 ‘시안 3종 · 수정 2회’가 바로 나타납니다. 고객은 이 목록을 보고 의뢰를 정합니다.',
      },
    ],
  },
  {
    no: 9,
    title: '프로필 노출을 켜면 공개됩니다',
    lead:
      '여기까지 하면 준비가 끝납니다. 마지막으로 프로필 탭 위쪽의 스위치를 켜야 탐색 화면에 올라갑니다.',
    bullets: [
      '공개된 작업이 1개 이상이어야 스위치를 켤 수 있습니다. 모자라면 무엇이 모자란지 그 자리에 적혀 있습니다.',
      '켜면 ‘노출’로 바뀌고, 탐색 화면과 상세 페이지에 바로 보입니다.',
      '언제든 다시 끌 수 있습니다. 꺼도 올려 둔 작업과 설정은 그대로 남습니다.',
      '이름 옆 ‘공개 페이지 보기 ↗’로 고객이 보는 화면을 그대로 확인할 수 있습니다.',
    ],
    shots: [
      {
        src: 'public-on.jpg',
        caption: '스위치를 켜면 초록색으로 바뀌고 ‘노출’이 됩니다.',
      },
      {
        src: 'public-page.jpg',
        caption:
          '고객이 보는 화면입니다. 소개글과 작업이 왼쪽에, 의뢰 유형과 금액이 오른쪽에 섭니다. 여기까지 확인되면 끝입니다.',
      },
    ],
  },
]

export function SetupGuide() {
  return (
    <div className="pb-8">
      <header>
        <h2 className="text-xl font-bold tracking-tight">세팅 가이드</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-neutral-600">
          처음 오셨다면 이 차례대로 따라오시면 됩니다. 프로필을 채우고, 작업을 올리고, 의뢰 받을
          유형을 고른 뒤 마지막에 노출 스위치를 켜면 공개됩니다.
        </p>
      </header>

      {/* 한눈에 보는 차례 — 긴 문서라 맨 위에 요약을 둔다 */}
      <ol className="mt-5 grid gap-x-6 gap-y-1.5 rounded-xl bg-neutral-50 p-4 text-sm text-neutral-700 sm:grid-cols-2">
        {STEPS.map((s) => (
          <li key={s.no} className="flex gap-2">
            <span className="w-4 shrink-0 text-right font-semibold text-violet-600">{s.no}</span>
            <a href={`#step-${s.no}`} className="hover:text-violet-700 hover:underline">
              {s.title}
            </a>
          </li>
        ))}
      </ol>

      <div className="mt-10 space-y-12">
        {STEPS.map((s) => (
          <section key={s.no} id={`step-${s.no}`} className="scroll-mt-6">
            <div className="flex items-baseline gap-2.5">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-violet-600 text-xs font-bold text-white">
                {s.no}
              </span>
              <h3 className="text-base font-bold tracking-tight">{s.title}</h3>
            </div>

            <p className="mt-2 text-sm leading-relaxed text-neutral-600">{s.lead}</p>

            {s.body?.map((p) => (
              <p key={p} className="mt-2 text-sm leading-relaxed text-neutral-600">
                {p}
              </p>
            ))}

            {s.bullets && (
              <ul className="mt-3 space-y-1.5">
                {s.bullets.map((b) => (
                  <li key={b} className="flex gap-2 text-sm leading-relaxed text-neutral-700">
                    <span aria-hidden className="mt-[7px] size-1 shrink-0 rounded-full bg-neutral-400" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            )}

            {s.note && (
              <p className="mt-3 rounded-lg bg-amber-50 px-3.5 py-3 text-sm leading-relaxed text-amber-900">
                {s.note}
              </p>
            )}

            {s.shots && (
              <div className="mt-4 space-y-5">
                {s.shots.map((shot) => (
                  <figure key={shot.src}>
                    {/* 테두리를 둘러 화면 그림임을 알아보게 한다 */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/guide/${shot.src}`}
                      alt={shot.caption}
                      loading="lazy"
                      className="w-full rounded-xl border border-neutral-200 bg-white"
                    />
                    <figcaption className="mt-2 text-xs leading-relaxed text-neutral-500">
                      {shot.caption}
                    </figcaption>
                  </figure>
                ))}
              </div>
            )}
          </section>
        ))}
      </div>

      <p className="mt-12 rounded-xl bg-neutral-50 px-4 py-4 text-sm leading-relaxed text-neutral-600">
        안내 그림은 실제 화면을 찍은 것이라 쓰는 기기나 창 크기에 따라 조금 다르게 보일 수 있습니다.
        따라 하다 막히거나 화면이 설명과 다르면 관리자에게 알려 주세요.
      </p>
    </div>
  )
}
