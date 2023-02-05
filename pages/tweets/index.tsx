import { Tweet } from '@/components/Tweet'
import Layout from '../../components/Layout'
import { PageSEO } from '@/components/SEO'
import { allTweets, type Tweet as TweetType } from 'contentlayer/generated'
import { compareDesc } from 'date-fns'
import Link from 'next/link'
import { useRouter } from 'next/router'

export const getStaticProps = async () => {
  const tweets: TweetType[] = allTweets
    .sort((a, b) => {
      return compareDesc(new Date(a.date), new Date(b.date))
    })
    .filter((tweet: TweetType) => tweet._id !== 'tweets/template-tweet.mdx')
  console.log({ tweets })

  return { props: { tweets } }
}

export default function Index({ tweets }) {
  const router = useRouter()
  return (
    <Layout>
      <PageSEO
        title="goosebumps.fm/tweets"
        description={'Archived tweets. Some of these have never actually been on twitter 😉'}
      />
      <h1 className="title">Tweets</h1>
      <p>Archived tweets. Some of these have never actually been on twitter 😉</p>

      <div className="max-w-4xl mx-auto mb-4">
        {tweets.map((tweet: TweetType, index) => {
          return (
            <div
              className="transition duration-300 ease-in-out delay-100 opacity-90 hover:opacity-100 "
              key={index}
              // onClick={() => router.push(`${tweet.url}`)}
            >
              <Tweet
                authorName={tweet.authorName}
                avatarUrl={tweet.avatarUrl}
                date={tweet.date}
                handle={tweet.handle}
                content={tweet.body.code}
              />
              <a onClick={() => router.push(`${tweet.url}`)}>view tweet</a>
            </div>
          )
        })}
      </div>
    </Layout>
  )
}
