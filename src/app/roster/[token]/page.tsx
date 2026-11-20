import type { Metadata } from 'next'
import { Cormorant_Garamond } from 'next/font/google'
import Link from 'next/link'
import { listRosterDesigners, listRosterFiles, openRosterLink, publicDesignerIds } from '@/lib/roster-db'
import { fileExt, fileSize, pickDesigners, previewKind } from '@/lib/roster-shape'
import { CareerText } from '@/components/career-text'
import { FilePreviewList } from '@/components/roster/file-preview'
import { dateTime } from '@/lib/format-date'
import { Img } from '@/components/img'

export const metadata: Metadata = {
  title: '디자이너 경력',
  /* 링크를 받은 사람만 여는 화면이다 — 검색에도, 메신저 미리보기 문구에도 실명을 내지 않는다 */
  robots: { index: false, follow: false },
}

/* 토큰 상태와 열람 기록을 매번 DB 에서 다룬다 — 미리 그려 둘 수 없는 화면이다 */
export const instant = false

/* 머리말의 영문 한 줄에만 쓴다 — 이 화면에서만 불러 다른 화면 용량에 얹지 않는다 */
const serif = Cormorant_Garamond({ subsets: ['latin'], weight: ['500'], style: ['italic'], display: 'swap' })

/* 비공개 디자이너 경력 페이지(0032·0033·0034).

   어드민이 만든 기한 있는 링크로만 열린다. 열 때마다 IP·브라우저를 남기고(openRosterLink),
   링크를 만들 때 체크한 디자이너만 보여 준다(designer_ids, 비어 있으면 전원).
   사이트 메뉴·푸터·챗봇은 붙이지 않는다(site-navbar·site-footer·chat-widget 의 HIDDEN). */
export default async function RosterPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const open = await openRosterLink(token)

  if (open.kind !== 'ok') {
    return <Unusable kind={open.kind} error={open.kind === 'error' ? open.error : undefined} />
  }

  const list = await listRosterDesigners()
  if (list.error) return <Unusable kind="error" error={list.error} />

  const designers = pickDesigners(list.rows, open.link.designer_ids)
  /* 파일 표(0035)가 없으면 파일 칸만 비운다 — 경력은 그대로 보인다 */
  const [linked, files] = await Promise.all([
    publicDesignerIds(designers.map((d) => d.designer_id).filter((i): i is string => Boolean(i))),
    listRosterFiles(designers.map((d) => d.id)),
  ])

  return (
    <main className="min-h-dvh flex-1 bg-[#f8f4ef] text-[#2b2326]">
      <div className="mx-auto max-w-3xl px-5 py-14 md:px-8 md:py-20">
        <header className="border-b border-[#e4dbd4] pb-8">
          <p className="text-[11px] font-semibold tracking-[0.2em] text-[#7b3a52]">SOOM · DESIGNER PROFILE</p>
          <h1 className="mt-4 text-[1.75rem] font-medium leading-snug tracking-[-0.04em] md:text-[2.25rem]">
            함께할 디자이너를 소개합니다
            <span className={`${serif.className} mt-1 block text-[1.3em] leading-tight text-[#7b3a52]`}>
              Meet the designers.
            </span>
          </h1>
          <p className="mt-5 text-sm leading-relaxed text-[#6f6366]">
            이 페이지는 링크를 받은 분께만 보이며, <b className="font-semibold text-[#2b2326]">{dateTime(open.link.expires_at)}</b>
            까지 열 수 있습니다.
          </p>
        </header>

        {designers.length === 0 ? (
          <p className="py-16 text-center text-sm text-[#6f6366]">
            소개할 디자이너 정보가 아직 준비되지 않았습니다. 링크를 보내 준 담당자에게 문의해 주세요.
          </p>
        ) : (
          <ol className="divide-y divide-[#e4dbd4]">
            {designers.map((d) => (
              <li key={d.id} className="grid gap-5 py-10 sm:grid-cols-[7rem_minmax(0,1fr)] sm:gap-8">
                <div className="flex items-center gap-4 sm:block">
                  {d.avatar_url ? (
                    <Img
                      src={d.avatar_url}
                      alt=""
                      focus="center"
                      className="size-20 shrink-0 overflow-hidden rounded-full ring-1 ring-[#e4dbd4] sm:size-28"
                    />
                  ) : (
                    <span
                      aria-hidden="true"
                      className="flex size-20 items-center justify-center rounded-full bg-[#ecd9d4] text-2xl font-medium text-[#5b2a3d] sm:size-28 sm:text-3xl"
                    >
                      {d.name.slice(0, 1)}
                    </span>
                  )}
                  <h2 className="text-xl font-semibold tracking-[-0.03em] sm:hidden">{d.name}</h2>
                </div>

                <div className="min-w-0">
                  <h2 className="hidden text-xl font-semibold tracking-[-0.03em] sm:block">{d.name}</h2>
                  {d.career.trim() ? (
                    <p className="whitespace-pre-line text-[15px] leading-[1.85] text-[#3d3437] sm:mt-3">
                      <CareerText
                        text={d.career}
                        linkClassName="text-[#7b3a52] underline decoration-[#7b3a52]/40 underline-offset-[3px] transition hover:decoration-[#7b3a52]"
                      />
                    </p>
                  ) : (
                    <p className="text-sm text-[#8f8385] sm:mt-3">경력 정보가 아직 없습니다.</p>
                  )}

                  {(files.byDesigner.get(d.id) ?? []).length > 0 && (
                    <div className="mt-6">
                      <p className="text-[11px] font-semibold tracking-[0.16em] text-[#8f8385]">PORTFOLIO FILES</p>
                      {/* 내려받기 없이 미리보기 다이얼로그로만 연다(file-preview.tsx) */}
                      <FilePreviewList
                        token={token}
                        files={(files.byDesigner.get(d.id) ?? []).flatMap((f) => {
                          const kind = previewKind(f.name)
                          return kind ? [{ id: f.id, name: f.name, ext: fileExt(f.name), size: fileSize(f.size), kind }] : []
                        })}
                      />
                    </div>
                  )}
                  {d.designer_id && linked.has(d.designer_id) && (
                    <Link
                      href={`/designers/${d.designer_id}`}
                      target="_blank"
                      className="mt-6 inline-flex min-h-11 items-center gap-3 border border-[#2b2326] px-5 text-sm font-semibold transition hover:bg-[#2b2326] hover:text-[#f8f4ef]"
                    >
                      포트폴리오 보기
                      <svg aria-hidden="true" viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M6.5 3.5 11 8l-4.5 4.5" />
                      </svg>
                      <span className="sr-only"> (새 탭에서 열기)</span>
                    </Link>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}

        <footer className="border-t border-[#e4dbd4] pt-6 text-xs text-[#8f8385]">
          © SOOM · 에이전시숨 — 이 페이지의 내용을 외부에 공유하지 말아 주세요.
        </footer>
      </div>
    </main>
  )
}

/* 못 여는 링크 — 왜 못 여는지를 구분해 알려 준다. 기한이 지났는지, 꺼졌는지를 알아야
   다시 보내 달라고 할지 판단할 수 있다. */
function Unusable({ kind, error }: { kind: 'missing' | 'expired' | 'revoked' | 'error'; error?: string }) {
  const text = {
    missing: { title: '없는 링크입니다', body: '주소가 잘못되었거나 삭제된 링크입니다. 링크를 보내 준 담당자에게 문의해 주세요.' },
    expired: { title: '열람 기한이 지났습니다', body: '이 링크는 기한이 지나 더는 열 수 없습니다. 필요하면 담당자에게 새 링크를 요청해 주세요.' },
    revoked: { title: '지금은 열 수 없는 링크입니다', body: '담당자가 이 링크를 비활성했습니다. 필요하면 담당자에게 문의해 주세요.' },
    error: { title: '페이지를 불러오지 못했습니다', body: error ?? '잠시 후 다시 시도해 주세요.' },
  }[kind]

  return (
    <main className="flex min-h-dvh flex-1 items-center bg-[#f8f4ef] text-[#2b2326]">
      <div className="mx-auto max-w-md px-5 py-20 text-center">
        <p className="text-[11px] font-semibold tracking-[0.2em] text-[#7b3a52]">SOOM</p>
        <h1 className="mt-4 text-2xl font-medium tracking-[-0.04em]">{text.title}</h1>
        <p className="mt-4 text-sm leading-relaxed text-[#6f6366]">{text.body}</p>
      </div>
    </main>
  )
}
