'use client'

import { useCallback, useState } from 'react'

/* src 가 바뀌면 처음부터 다시 — loaded 상태가 이전 사진의 것으로 남으면
   새 사진이 아직 안 왔는데 다 온 것처럼 보인다. key 로 갈아끼운다. */
type ImgProps = {
  src: string
  alt: string
  className?: string
  ratio?: string
  /* 칸 비율을 클래스로 못 정할 때(값이 데이터마다 다를 때) — 예: { aspectRatio: 0.8 } */
  style?: React.CSSProperties
  /* 칸보다 길 때 어느 쪽을 남길지. 기본은 위 — 포트폴리오는 위가 첫인상이다 */
  focus?: 'top' | 'center'
}

export function Img(props: ImgProps) {
  return <OneImage key={props.src} {...props} />
}

function OneImage({ src, alt, className = '', ratio = '', style, focus = 'top' }: ImgProps) {
  const [loaded, setLoaded] = useState(false)

  /* 캐시에 있던 이미지는 React 가 onLoad 를 붙이기 전에 로드가 끝난다 —
     그러면 onLoad 가 영영 오지 않아 opacity-0 인 채로 남는다.
     ref 가 붙는 시점에 complete 를 직접 확인해 그 경우를 건진다.

     깨진 이미지도 complete 는 참이다. 거기서 멈춰 회색으로 두면 무엇이
     잘못됐는지 알 수 없으므로 함께 드러낸다 — alt 가 보이는 편이 낫다. */
  const check = useCallback((img: HTMLImageElement | null) => {
    if (img?.complete) setLoaded(true)
  }, [])

  return (
    <div className={`relative overflow-hidden bg-neutral-200 ${ratio} ${className}`} style={style}>
      {!loaded && <div className="absolute inset-0 animate-pulse bg-gradient-to-b from-neutral-200 to-neutral-300" />}
      {/* 외부 플레이스홀더 이미지라 next/image 대신 img — remotePatterns 설정이 필요 없다 */}
      <img
        ref={check}
        src={src}
        alt={alt}
        loading="lazy"
        onLoad={() => setLoaded(true)}
        onError={() => setLoaded(true)}
        className={`h-full w-full object-cover ${focus === 'center' ? 'object-center' : 'object-top'} transition-opacity duration-700 ${loaded ? 'opacity-100' : 'opacity-0'}`}
      />
    </div>
  )
}
