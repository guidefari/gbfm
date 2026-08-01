import { useAtomSet, useAtomValue } from '@effect/atom-react'
import { Schema } from 'effect'
import { persistedAtom } from './persistedAtom'

const MAX_SEEN = 200

const TweetBrowseState = Schema.Struct({
  version: Schema.Literal(1),
  lastViewed: Schema.NullOr(
    Schema.Struct({
      postId: Schema.String,
      slug: Schema.String,
      viewedAt: Schema.Number
    })
  ),
  seenSlugs: Schema.Array(Schema.String)
})

export type TweetBrowseState = (typeof TweetBrowseState)['Type']
export type TweetIdentity = {
  readonly postId: string
  readonly slug: string
}

const initialState: TweetBrowseState = {
  version: 1,
  lastViewed: null,
  seenSlugs: []
}

const {
  atom: tweetBrowseAtom,
  read,
  write
} = persistedAtom({
  key: 'gbfm-tweet-browse-state.json',
  schema: TweetBrowseState,
  fallback: initialState
})

export { tweetBrowseAtom }

export const readTweetBrowseState = read
export const useTweetBrowseState = (): TweetBrowseState => useAtomValue(tweetBrowseAtom)
export const useSeenTweets = (): readonly string[] => useTweetBrowseState().seenSlugs
export const useResumeTweet = () => useTweetBrowseState().lastViewed

export const useRecordTweetViewed = () => {
  const set = useAtomSet(tweetBrowseAtom)
  return (tweet: TweetIdentity) =>
    set((prev) => {
      const seenSlugs = prev.seenSlugs.includes(tweet.slug)
        ? prev.seenSlugs
        : [...prev.seenSlugs, tweet.slug].slice(-MAX_SEEN)
      const next = {
        version: 1 as const,
        lastViewed: { ...tweet, viewedAt: Date.now() },
        seenSlugs
      }
      write(next)
      return next
    })
}

export const useResetTweetBrowse = () => {
  const set = useAtomSet(tweetBrowseAtom)
  return () =>
    set(() => {
      write(initialState)
      return initialState
    })
}
