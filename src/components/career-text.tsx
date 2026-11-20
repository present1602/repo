import { splitCareer } from '@/lib/career-links'

/* 경력 글 — [글자](주소) 꼴만 링크로, 나머지는 글자 그대로(줄바꿈 유지는 감싸는 쪽의 whitespace-pre-line).
   링크는 새 탭으로 연다 — 경력 페이지를 닫지 않고 둘러보게. */
export function CareerText({ text, linkClassName = '' }: { text: string; linkClassName?: string }) {
  return (
    <>
      {splitCareer(text).map((p, i) =>
        p.href ? (
          <a key={i} href={p.href} target="_blank" rel="noopener noreferrer" className={linkClassName}>
            {p.text}
          </a>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </>
  )
}
