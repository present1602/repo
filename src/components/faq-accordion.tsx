'use client'

import { useRef } from 'react'
import type { Faq } from '@/lib/faq-shape'

/* 공개 FAQ 목록 — 하나를 펼치면 열려 있던 것이 접힌다.

   <details> 를 그대로 쓴다. 자바스크립트가 아직 안 붙었어도 펼쳐지고,
   검색 크롤러도 접힌 답을 읽는다 — 직접 만든 토글로 바꾸면 둘 다 잃는다.
   여닫는 일은 브라우저에 맡기고, 우리는 '열렸다'는 소식을 받아 나머지를
   닫기만 한다(toggle 이벤트).

   열린 것을 state 로 들지 않는다. state 로 열고 닫으면 자바스크립트가 붙기
   전의 화면과 붙은 뒤의 화면이 달라져 한 번 깜빡인다. DOM 의 open 을
   그대로 두고 필요할 때만 끄는 편이 조용하다. */
export function FaqAccordion({ faqs }: { faqs: Faq[] }) {
  const root = useRef<HTMLDivElement>(null)

  /* toggle 은 거품이 일지 않아 onToggle 을 각 details 에 단다.
     열린 것 말고 나머지를 닫는다 — 접히는 쪽은 할 일이 없다. */
  const closeOthers = (e: React.SyntheticEvent<HTMLDetailsElement>) => {
    if (!e.currentTarget.open) return
    const opened = e.currentTarget
    root.current?.querySelectorAll('details[open]').forEach((d) => {
      if (d !== opened) (d as HTMLDetailsElement).open = false
    })
  }

  return (
    <div ref={root} className="divide-y divide-line border-y border-ink">
      {faqs.map((f, i) => (
        <details key={f.id} onToggle={closeOthers} className="group">
          <summary className="grid cursor-pointer list-none grid-cols-[2.5rem_1fr_auto] items-start gap-3 py-6 text-left [&::-webkit-details-marker]:hidden md:grid-cols-[3.5rem_1fr_auto]">
            <span className="font-serif text-xl leading-7 italic text-plum">{String(i + 1).padStart(2, '0')}</span>
            <span className="text-base leading-7 font-semibold tracking-[-0.02em] transition group-hover:text-plum md:text-[17px]">{f.question}</span>
            {/* 펼침 표시 — 더하기가 열리면 빼기로 바뀐다 */}
            <span aria-hidden className="relative mt-1.5 grid size-5 shrink-0 place-items-center text-ink-soft">
              <span className="absolute h-px w-3.5 bg-current" />
              <span className="absolute h-3.5 w-px bg-current transition group-open:rotate-90 group-open:opacity-0" />
            </span>
          </summary>
          {/* 줄바꿈을 적은 그대로 내보낸다(어드민 안내 문구와 같은 약속) */}
          <p className="-mt-2 whitespace-pre-wrap pb-7 pl-[3.25rem] pr-8 text-sm leading-[1.85] text-ink-soft md:pl-[4.25rem]">
            {f.answer}
          </p>
        </details>
      ))}
    </div>
  )
}
