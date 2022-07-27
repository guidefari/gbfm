import { getAllFilesFrontMatter } from '@/lib/mdx'
import siteMetadata from '@/data/siteMetadata'
import ListLayout from '@/layouts/ListLayout'
import { PageSEO } from '@/components/SEO'

export const POSTS_PER_PAGE = 20

export async function getStaticProps() {
  const posts = await getAllFilesFrontMatter('curated')
  const initialDisplayPosts = posts.slice(0, POSTS_PER_PAGE)
  const pagination = {
    currentPage: 1,
    totalPages: Math.ceil(posts.length / POSTS_PER_PAGE),
  }

  return { props: { initialDisplayPosts, posts, pagination } }
}

export default function Curated({ posts, initialDisplayPosts, pagination }) {
  return (
    <>
      <PageSEO
        title={`Curated Sounds - ${siteMetadata.author}`}
        description={siteMetadata.description}
      />
      <ListLayout
        artefactType={'blog'}
        posts={posts}
        initialDisplayPosts={initialDisplayPosts}
        pagination={pagination}
        title="All Posts"
      />
    </>
  )
}
