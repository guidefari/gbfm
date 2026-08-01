import { useAtomSet, useAtomValue } from '@effect/atom-react'
import { Schema } from 'effect'
import { persistedAtom } from './persistedAtom'

const MAX_SEEN = 200

const SeenTweets = Schema.Array(Schema.String)

const { atom: seenTweetsAtom, write } = persistedAtom({
  key: 'gbfm-tweet-seen.json',
  schema: SeenTweets,
  fallback: []
})

export { seenTweetsAtom }

export const useSeenTweets = (): readonly string[] => useAtomValue(seenTweetsAtom)

export const useMarkTweetSeen = () => {
  const set = useAtomSet(seenTweetsAtom)
  return (slug: string) =>
    set((prev) => {
      if (prev.includes(slug)) return prev
      const next = [...prev, slug]
      const capped = next.length > MAX_SEEN ? next.slice(next.length - MAX_SEEN) : next
      write(capped)
      return capped
    })
}

export const useResetSeenTweets = () => {
  const set = useAtomSet(seenTweetsAtom)
  return () =>
    set(() => {
      write([])
      return []
    })
}
