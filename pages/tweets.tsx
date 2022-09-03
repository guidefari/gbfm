import CustomLink from '@/components/CustomLink'
import { Tweet } from '@/components/Tweet'
import { Tweet as TweetType } from '@/lib/types'
import fs from 'fs'
import matter from 'gray-matter'
import { serialize } from 'next-mdx-remote/serialize'
import path from 'path'
import { SuperHero } from '../components/FrontPage/SuperHero'
import Layout from '../components/Layout'
import { postFilePaths, POSTS_PATH, tweetFilePaths, TWEETS_PATH } from '../utils/mdxUtils'

export default function Index({ tweets }) {
  console.log(tweets)

  const draftsFilteredOut = tweets.filter((tweet) => tweet.data.draft !== true)

  return (
    <div>yo</div>
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

export const getStaticProps = async () => {
  const tweets = await tweetFilePaths.map(async (filePath) => {
    const source = fs.readFileSync(path.join(TWEETS_PATH, filePath))
    const { content, data } = matter(source)

    const mdxSource = await serialize(content, {
      // Optionally pass remark/rehype plugins
      mdxOptions: {
        remarkPlugins: [],
        rehypePlugins: [],
      },
      scope: data,
    })

    return {
      mdxSource,
      data,
    }
  })
  console.log('====================================')
  console.log(tweets)
  console.log('====================================')

  return { props: { tweets } }
}
