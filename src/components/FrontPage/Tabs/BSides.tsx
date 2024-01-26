import { Tweet } from 'src/components/Tweet'
import { PageSEO } from 'src/components/SEO'
import { allTweets, type Tweet as TweetType } from '@/contentlayer/generated'
import { compareDesc } from 'date-fns'
import { PageTitle } from '@/components/common/PageTitle'

export function Bsides() {
  const tweets: TweetType[] = allTweets
    .sort((a, b) => compareDesc(new Date(a.date), new Date(b.date)))
    .filter((tweet: TweetType) => tweet._id !== 'micro/template-tweet.mdx')
  return (
    <>
      <PageSEO title="goosebumps.fm/micro" description="Micro posts and archived tweets." />
      <PageTitle
        title="B-sides"
        description="Too small to be an entire post. Kind of like a tweet. Sometimes ephemeral thoughts"
      />

      <div className="max-w-4xl mx-auto mb-4">
        {tweets.map((tweet: TweetType, index) => (
          <div
            className="transition duration-300 ease-in-out delay-100 opacity-90 hover:opacity-100 "
            key={index}
          >
            <Tweet
              authorName={tweet.authorName}
              avatarUrl={tweet.avatarUrl}
              date={tweet.date}
              handle={tweet.handle}
              content={tweet.body.code}
              url={tweet.url}
            />
          </div>
        ))}
      </div>
    </>
  )
}
