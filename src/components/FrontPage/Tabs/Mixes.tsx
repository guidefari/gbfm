import { Mix } from '.contentlayer/generated/types'
import { PostCard } from '@/components/PostCard'
import { PageTitle } from '@/components/common/PageTitle'
import { allMixes } from '@/contentlayer/generated'
import { DEFAULT_IMAGE_URL } from '@/src/constants'
import { compareDesc } from 'date-fns'
import Link from 'next/link'
import React from 'react'

export const Mixes = () => {
  const mixes: Mix[] = allMixes.sort((a, b) => compareDesc(new Date(a.date), new Date(b.date)))

  const Description = () => (
    <>
      Stream or download on here. Also distribured via <Link href={'/rss.xml'}>RSS</Link>
    </>
  )

  return (
    <section id="mixes">
      <PageTitle title="Mixes" description={<Description />} />
      <div className="curated-posts">
        {mixes.map((mix: Mix) => (
          <PostCard
            slug={mix.url}
            title={mix.title}
            description={mix.description}
            date={mix.date}
            key={mix._id}
            thumbnailUrl={mix.thumbnailUrl ?? DEFAULT_IMAGE_URL}
          />
        ))}
      </div>
    </section>
  )
}
