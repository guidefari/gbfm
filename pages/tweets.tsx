import { Tweet } from '@/components/Tweet'
import Layout from '../components/Layout'
import { PageSEO } from '@/components/SEO'
import { allTweets, type Tweet as TweetType } from 'contentlayer/generated'
import { compareDesc } from 'date-fns'

export const getStaticProps = async () => {
  const tweets: TweetType[] = allTweets.sort((a, b) => {
    return compareDesc(new Date(a.date), new Date(b.date))
  })
  console.log({ tweets })

  return { props: { tweets } }
}

export default function Index({ tweets }) {
  console.log('tweets:', tweets)
  return (
    <Layout>
      <PageSEO
        title="goosebumps.fm/tweets"
        description={'Archived tweets. Some of these have never actually been on twitter 😉'}
      />
      <h1 className="title">Tweets</h1>
      <p>Archived tweets. Some of these have never actually been on twitter 😉</p>
      <hr className="border-gb-pastel-green-2" />

      <div className="max-w-5xl mx-auto mb-4">
        {tweets.map((tweet: TweetType, index) => {
          return (
            <Tweet
              authorName={tweet.authorName}
              avatarUrl={tweet.avatarUrl}
              date={tweet.date}
              handle={tweet.handle}
              key={index}
              content={tweet.body.code}
            />
          )
        })}
      </div>
    </Layout>
  )
}
