import { PostCard } from '@/components/PostCard'
import { PageSEO } from '@/components/SEO'
import Layout from '../components/Layout'
import { compareDesc } from 'date-fns'
import { allPosts, type Post } from 'contentlayer/generated'

export function getStaticProps() {
  const posts: Post[] = allPosts.sort((a, b) => {
    return compareDesc(new Date(a.date), new Date(b.date))
  })
  console.log({ posts })

  return { props: { posts } }
}

export default function Index({ posts }) {
  const draftsFilteredOut = posts.filter((post) => post?.data?.draft !== true)

  return (
    <Layout>
      <PageSEO title="Curated music - Posts" description={'Curated Music & the occasional prose'} />
      <h3 className="title">Prose, Sounds, Research</h3>
      <section className="grid grid-cols-1 gap-12 mx-4 lg:mx-auto max-w-7xl lg:gap-24 lg:grid-cols-2">
        {draftsFilteredOut.map((post: Post) => (
          <PostCard
            slug={post.url}
            title={post.title}
            description={post.description}
            date={post.date}
            key={post._id}
            thumbnailUrl={post.thumbnailUrl ? post.thumbnailUrl : ''}
          />
        ))}
      </section>
    </Layout>
  )
}
