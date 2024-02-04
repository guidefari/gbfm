import { Post } from '.contentlayer/generated/types'
import { PostCard } from '@/components/PostCard'
import { PageTitle } from '@/components/common/PageTitle'
import { allPosts } from '@/contentlayer/generated'
import { DEFAULT_IMAGE_URL } from '@/src/constants'
import { compareDesc } from 'date-fns'
import React from 'react'

export const Words = () => {
  const posts: Post[] = allPosts
    .sort((a, b) => compareDesc(new Date(a.lastmod || a.date), new Date(b.lastmod || b.date)))
    .filter((post) => post.title !== 'Template post')
  const draftsFilteredOut = posts.filter((post) => post?.draft !== true)

  return (
    <section id="words">
      <PageTitle title="Words" />
      <div className="curated-posts">
        {draftsFilteredOut.map((post: Post) => (
          <PostCard
            slug={post.url}
            title={post.title}
            description={post.description}
            date={post.date}
            key={post._id}
            thumbnailUrl={post.thumbnailUrl ?? DEFAULT_IMAGE_URL}
          />
        ))}
      </div>
    </section>
  )
}
