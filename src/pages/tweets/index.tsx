import { Tweet } from 'src/components/Tweet'
import { PageSEO } from 'src/components/SEO'
import { allTweets, type Tweet as TweetType } from 'contentlayer/generated'
import { compareDesc } from 'date-fns'
import Link from 'next/link'
import { useRouter } from 'next/router'
import Layout from '../../components/Layout'

export default function Index() {
  const tweets: TweetType[] = allTweets
    .sort((a, b) => compareDesc(new Date(a.date), new Date(b.date)))
    .filter((tweet: TweetType) => tweet._id !== 'tweets/template-tweet.mdx')
  const router = useRouter()
  return (
    <Layout>
      <PageSEO
        title="goosebumps.fm/tweets"
        description="Archived tweets. Some of these have never actually been on twitter 😉"
      />
      <h1 className="title">Bumps</h1>
      <p>Micro Posts - too small to be an entire post. Kind of like a tweet</p>

      <div className="max-w-4xl mx-auto mb-4">
        {tweets.map((tweet: TweetType, index) => (
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
          </div>
        ))}
      </div>
    </Layout>
  )
}
