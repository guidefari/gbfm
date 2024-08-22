import type { Mix } from '.contentlayer/generated/types'
import { PostCard } from '@/components/PostCard'
import { RSS } from '@/components/RSS'
import { PageTitle } from '@/components/common/PageTitle'
import { allMixes } from '@/contentlayer/generated'
import { DEFAULT_IMAGE_URL } from '@/constants'
import { compareDesc } from 'date-fns'
import React from 'react'

export const Mixes = () => {
  const mixes: Mix[] = allMixes.sort((a, b) => compareDesc(new Date(a.date), new Date(b.date)))

  const Description = () => (
    <p className="leading-snug">
      Stream or download on here. <br />
      Also distribured via <RSS />.<br />
      <a className="text-sm text-orange-300" href="https://thepodcasting.org/what-is-rss-feed/">
        What is RSS?
      </a>
    </p>
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
