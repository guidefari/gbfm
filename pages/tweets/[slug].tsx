import Head from 'next/head'
import { format, parseISO } from 'date-fns'
import { allTweets, type Tweet } from 'contentlayer/generated'
import { Tweet as SingleTweet } from '@/components/Tweet'

export async function getStaticPaths() {
  const paths: string[] = allTweets.map((tweet) => tweet.url)
  return {
    paths,
    fallback: false,
  }
}

export async function getStaticProps({ params }) {
  const tweet: Tweet = allTweets.find(
    (tweet) => tweet._raw.flattenedPath === `tweets/${params.slug}`
  )
  return {
    props: {
      tweet,
    },
  }
}

const PostLayout = ({ tweet }: { tweet: Tweet }) => (
  <>
    {/* <Head>
        <title>{tweeti}</title>
      </Head> */}
    <article className="max-w-4xl py-8 mx-auto ">
      <SingleTweet
        authorName={tweet.authorName}
        avatarUrl={tweet.avatarUrl}
        date={tweet.date}
        handle={tweet.handle}
        content={tweet.body.code}
      />
    </article>
  </>
)

export default PostLayout
