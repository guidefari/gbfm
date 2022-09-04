import CustomLink from '@/components/CustomLink'
import { Tweet } from '@/components/Tweet'
import { Tweet as TweetType } from '@/lib/types'
import fs from 'fs'
import matter from 'gray-matter'
import { serialize } from 'next-mdx-remote/serialize'
import dynamic from 'next/dynamic'
import path from 'path'
import { SuperHero } from '../components/FrontPage/SuperHero'
import Head from 'next/head'

import Layout from '../components/Layout'
import { postFilePaths, POSTS_PATH, tweetFilePaths, TWEETS_PATH } from '../utils/mdxUtils'
import { MDXRemote } from 'next-mdx-remote'
import { useEffect, useState } from 'react'

const components = {
  a: CustomLink,
  // It also works with dynamically-imported components, which is especially
  // useful for conditionally loading components for certain routes.
  // See the notes in README.md for more details.
  TestComponent: dynamic(() => import('../components/TestComponent')),
  Album: dynamic(() => import('../components/Album')),
  Track: dynamic(() => import('../components/Track')),
  Head,
}

export default function Index({ tweets }) {
  const [tweetsState, setTweetsState] = useState([null])

  const draftsFilteredOut = tweets.filter((tweet) => tweet.data.draft !== true)
  const fixedItems = draftsFilteredOut.map(async (tweet) => await fixShit(tweet))

  useEffect(() => {
    // if (fixedItems) setTweetsState([...fixedItems])
    console.log('====================================')
    console.log(fixedItems)
    console.log('====================================')
  }, [fixedItems])

  async function fixShit(post) {
    const fixedShit = await Promise.resolve(
      serialize(post.content, {
        // Optionally pass remark/rehype plugins
        mdxOptions: {
          remarkPlugins: [],
          rehypePlugins: [],
        },
        scope: post.data,
      })
    )

    return { frontMatter: post.data, content: fixedShit }
  }

  return (
    <>
      {fixedItems
        ? draftsFilteredOut.map((tweet, index) => {
            return (
              <Tweet
                authorName="sd"
                avatarUrl={tweet.data.avatarUrl}
                date="sds"
                handle="sdfsd"
                key={index}
              >
                {/* {serialize(tweet.content)} */}
                {/* <MDXRemote {...tweet.content} components={components} /> */}
              </Tweet>
            )
          })
        : ''}
    </>
    // <Layout>
    //   <SuperHero />
    //   <h3 className="title">Words & Sounds</h3>
    //   <ul className="ml-5">
    //     {draftsFilteredOut.map((tweet:{data: TweetType}: ) => (
    //       <Tweet
    //       authorName={tweet.data}
    //       >
    //         {tweet.data}
    //       </Tweet>
    //   <li key={post.filePath}>
    //     <CustomLink
    //       as={`/curated/${post.filePath.replace(/\.mdx?$/, '')}`}
    //       href={`/curated/[slug]`}
    //     >
    //       <a className="underline"> - {post.data.title}</a>
    //     </CustomLink>
    //   </li>
    //     ))}
    //   </ul>
    // </Layout>
  )
}

// export const getStaticPaths = async () => {
//   const paths = postFilePaths
//     // Remove file extensions for page paths
//     .map((path) => path.replace(/\.mdx?$/, ''))
//     // Map the path into the static paths object required by Next.js
//     .map((slug) => ({ params: { slug } }))

//   return {
//     paths,
//     fallback: false,
//   }
// }

export const getStaticProps = () => {
  const tweets = tweetFilePaths.map((filePath) => {
    const source = fs.readFileSync(path.join(TWEETS_PATH, filePath))
    const { content, data } = matter(source)

    return {
      content,
      data,
      filePath,
    }
  })

  return { props: { tweets } }
}
