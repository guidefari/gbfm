import { PostCard } from '@/components/PostCard'
import fs from 'fs'
import matter from 'gray-matter'
import path from 'path'
import { SuperHero } from '../components/FrontPage/SuperHero'
import Layout from '../components/Layout'
import { postFilePaths, POSTS_PATH } from '../utils/mdxUtils'

export default function Index({ posts }) {
  console.log(posts)

  const draftsFilteredOut = posts.filter((post) => post.data.draft !== true)

  return (
    <Layout>
      <SuperHero />
      <h3 className="title">Prose & Sounds</h3>
      <section className="grid grid-cols-1 gap-12 mx-4 lg:mx-auto max-w-7xl lg:gap-24 lg:grid-cols-2">
        {draftsFilteredOut.map((post) => (
          <PostCard
            slug={`/curated/${post.filePath.replace(/\.mdx?$/, '')}`}
            title={post.data.title}
            description={post.data.description}
            date={post.data.date ? new Date(post?.data?.date).toDateString() : ''}
            key={post.filePath}
            thumbnailUrl={post.data.thumbnailUrl ? post.data.thumbnailUrl : ''}
          />
        ))}
      </section>
    </Layout>
  )
}

export function getStaticProps() {
  const posts = postFilePaths.map((filePath) => {
    const source = fs.readFileSync(path.join(POSTS_PATH, filePath))
    const { content, data } = matter(source)

    return {
      content,
      data,
      filePath,
    }
  })

  return { props: { posts } }
}
