/* 제안서 펼침면을 이루는 부품.

   v1 과 v1.1 이 함께 쓴다 — 시안을 여러 벌 두더라도 종이의 짜임(여백,
   난외주, 스냅 높이)은 같아야 같은 책의 다른 판으로 읽힌다. */

export function Label({ children, light }: { children: React.ReactNode; light?: boolean }) {
  return (
    <p
      className={`text-[11px] font-medium uppercase tracking-[0.35em] ${
        light ? 'text-violet-300' : 'text-violet-600'
      }`}
    >
      {children}
    </p>
  )
}

export function Rule() {
  return <div className="my-6 h-0.5 w-16 bg-violet-600 md:my-8" />
}

/* 펼침면 한 장 — 넓은 화면에서는 좌우 두 쪽, 좁은 화면에서는 위아래로 쌓인다 */
export function Spread({ id, children }: { id: number; children: React.ReactNode }) {
  return (
    <section
      id={`p${id}`}
      /* 폭을 묶지 않는다 — 넓은 화면에서 펼침면이 화면을 가득 쓴다.
         proposal-spread — 스냅 지점이자 한 화면에 맞는 높이(globals.css) */
      className="proposal-spread grid w-full scroll-mt-20 overflow-hidden rounded-lg shadow-xl shadow-neutral-300/60 md:grid-cols-2 md:divide-x md:divide-neutral-300"
    >
      {children}
    </section>
  )
}

/* 펼침면의 한 쪽.

   위아래의 작은 글자는 잡지의 난외주를 흉내 낸 것이다 — 좁은 화면에서는
   자리만 차지하므로 감춘다. */
export function Half({
  children,
  tone = 'cream',
  top,
  foot,
}: {
  children: React.ReactNode
  tone?: 'cream' | 'white' | 'dark'
  top: [string, string]
  foot: [string, string]
}) {
  const bg =
    tone === 'cream'
      ? 'bg-[#faf6f0]'
      : tone === 'white'
        ? 'bg-white'
        : 'bg-neutral-950 text-white'

  /* 어두운 쪽에서는 난외주도 함께 밝아져야 읽힌다 */
  const meta = tone === 'dark' ? 'text-white/70' : 'text-neutral-500'

  return (
    <div className={`relative flex flex-col p-7 md:p-12 ${bg}`}>
      <div
        className={`hidden justify-between text-[10px] uppercase tracking-[0.3em] md:flex ${meta}`}
      >
        <span>{top[0]}</span>
        <span>{top[1]}</span>
      </div>

      <div className="flex flex-1 flex-col justify-center md:py-12">{children}</div>

      <div
        className={`hidden justify-between text-[10px] uppercase tracking-[0.3em] md:flex ${meta}`}
      >
        <span>{foot[0]}</span>
        <span>{foot[1]}</span>
      </div>
    </div>
  )
}

export const pad = (n: number) => String(n).padStart(2, '0')
