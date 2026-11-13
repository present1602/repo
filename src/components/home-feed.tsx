'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { FeedWork } from '@/lib/designer-shape'
import { displayNameOf } from '@/lib/display-name'
import { Img } from './img'
import { WorkModal } from './work-modal'
import styles from './home.module.css'

export function HomeFeed({ works }: { works: FeedWork[] }) {
  const [index, setIndex] = useState<number | null>(null)
  if (works.length === 0) return <p className={styles.emptyWorks}>새로운 작업을 준비하고 있습니다.</p>

  return (
    <>
      <div className={styles.workGrid}>
        {works.map((work, i) => (
          <article key={work.id} className={styles.workCard}>
            <button type="button" onClick={() => setIndex(i)} className={styles.workPreview} aria-label={`${work.title || '디자인 작업'} 크게 보기`}>
              <Img src={work.thumb_url} alt={work.title || '디자이너 작업'} className={styles.workImage} />
              <span className={styles.workOpen} aria-hidden="true">↗</span>
            </button>
            <div className={styles.workCaption}>
              <div>
                <h3>{work.title || displayNameOf(work.designer)}</h3>
                <Link href={`/designers/${work.designer.id}`} className={styles.workDesigner}>{work.title ? displayNameOf(work.designer) : '디자이너 보기'} <span aria-hidden="true">↗</span></Link>
              </div>
              {work.designer.tags[0] && <span className={styles.workTag}>{work.designer.tags[0]}</span>}
            </div>
          </article>
        ))}
      </div>
      {index !== null && (
        <WorkModal works={works} index={index} setIndex={setIndex} onClose={() => setIndex(null)} nameOf={(work) => displayNameOf(work.designer)} hrefOf={(work) => `/designers/${work.designer.id}`} />
      )}
    </>
  )
}
