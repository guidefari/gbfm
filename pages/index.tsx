import fs from 'fs'
import matter from 'gray-matter'
import Link from 'next/link'
import path from 'path'
import { SuperHero } from '../components/FrontPage/SuperHero'
import Layout from '../components/Layout'
import { postFilePaths, POSTS_PATH } from '../utils/mdxUtils'

export default function Index({ posts }) {
  return (
    <Layout>
      <SuperHero />
      <h3 className="title">Words & Sounds</h3>
      <ul className="ml-5">
        {posts.map((post) => (
          <li key={post.filePath}>
            <Link as={`/curated/${post.filePath.replace(/\.mdx?$/, '')}`} href={`/curated/[slug]`}>
              <a className="underline"> - {post.data.title}</a>
            </Link>
          </li>
        ))}
      </ul>
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
