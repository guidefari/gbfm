import { allTweets, type Tweet } from '@/contentlayer/generated'
import { Tweet as SingleTweet } from 'src/components/Tweet'
import { GetStaticProps } from 'next'

export function getStaticPaths() {
  const paths: string[] = allTweets.map((tweet) => tweet.url)
  return {
    paths,
    fallback: false,
  }
}

export const getStaticProps: GetStaticProps<{ tweet: Tweet }> = ({ params }) => {
  const tweet: Tweet = allTweets.find(
    (singleTweet) => singleTweet._raw.flattenedPath === `micro/${params.slug}`
  )
  return {
    props: {
      tweet,
    },
  }
}

const PostLayout = ({ tweet }: { tweet: Tweet }) => (
  <>
    <article className="max-w-4xl min-h-screen py-8 mx-auto">
      <SingleTweet
        authorName={tweet.authorName}
        avatarUrl={tweet.avatarUrl}
        date={tweet.date}
        handle={tweet.handle}
        content={tweet.body.code}
        underline={false}
      />
    </article>
  </>
)

export default PostLayout
