import { Mix } from '.contentlayer/generated/types'
import { PostCard } from '@/components/PostCard'
import { allMixes } from '@/contentlayer/generated'
import { DEFAULT_IMAGE_URL } from '@/src/constants'
import { compareDesc } from 'date-fns'
import Link from 'next/link'
import React from 'react'

export const Mixes = () => {
  const mixes: Mix[] = allMixes.sort((a, b) => compareDesc(new Date(a.date), new Date(b.date)))

  return (
    <section id="mixes">
      <div className="flex flex-col m-4 md:flex-row md:items-center ">
        <div className="text-4xl font-bold sm:text-6xl md:text-7xl">Mixes</div>
        <p className="text-sm font-normal leading-5 md:ml-4 md:mt-3 md:text-base">
          Stream or download on here. Also distribured via <Link href={'/rss.xml'}>RSS</Link>
        </p>
      </div>
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
