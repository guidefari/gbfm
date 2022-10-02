import CustomLink from '@/components/CustomLink'
import { Tweet } from '@/components/Tweet'
import fs from 'fs'
import matter from 'gray-matter'
import { serialize } from 'next-mdx-remote/serialize'
import dynamic from 'next/dynamic'
import path from 'path'
import Head from 'next/head'

import Layout from '../components/Layout'
import { tweetFilePaths, TWEETS_PATH } from '../utils/mdxUtils'
import { MDXRemote } from 'next-mdx-remote'

const components = {
  a: CustomLink,
  // It also works with dynamically-imported components, which is especially
  // useful for conditionally loading components for certain routes.
  // See the notes in README.md for more details.
  Album: dynamic(() => import('../components/Album')),
  Track: dynamic(() => import('../components/Track')),
  Head,
}

export default function Index({ tweets }) {
  console.log('tweets:', tweets)
  return (
    <Layout>
      <h1 className="title">Short form prose</h1>

      {/* <div className="container grid gap-8 pt-6 mx-auto sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3"> */}
      {tweets.map((tweet, index) => {
        return (
          <Tweet
            authorName={tweet.scope.authorName}
            avatarUrl={tweet.scope.avatarUrl}
            date={tweet.scope.date}
            handle={tweet.scope.handle}
            key={index}
          >
            <MDXRemote compiledSource={tweet.compiledSource} components={components} />
          </Tweet>
        )
      })}
      {/* </div> */}
    </Layout>
  )
}

export const getStaticProps = async () => {
  const tweets = await Promise.all(
    tweetFilePaths.map(async (filePath) => {
      const source = fs.readFileSync(path.join(TWEETS_PATH, filePath))
      const { content, data } = matter(source)

      const serialized = await serialize(content, {
        // Optionally pass remark/rehype plugins
        mdxOptions: {
          remarkPlugins: [],
          rehypePlugins: [],
        },
        parseFrontmatter: true,
        scope: data,
      })

      return serialized
    })
  )

  const draftsFilteredOutAndSorted = tweets
    .filter((tweet) => tweet.scope.draft !== true)
    // @ts-expect-error
    .sort((a, b) => new Date(b.scope.date).getTime - new Date(a.scope.date).getTime)

  return { props: { tweets: draftsFilteredOutAndSorted } }
}
