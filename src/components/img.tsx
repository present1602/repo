'use client'

import { useState } from 'react'

export function Img({
  src,
  alt,
  className = '',
  ratio = '',
}: {
  src: string
  alt: string
  className?: string
  ratio?: string
}) {
  const [loaded, setLoaded] = useState(false)
  return (
    <div className={`relative overflow-hidden bg-neutral-200 ${ratio} ${className}`}>
      {!loaded && <div className="absolute inset-0 animate-pulse bg-gradient-to-b from-neutral-200 to-neutral-300" />}
      {/* 외부 플레이스홀더 이미지라 next/image 대신 img — remotePatterns 설정이 필요 없다 */}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        onLoad={() => setLoaded(true)}
        className={`h-full w-full object-cover object-top transition-opacity duration-700 ${loaded ? 'opacity-100' : 'opacity-0'}`}
      />
    </div>
  )
}
