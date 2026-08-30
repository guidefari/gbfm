import { useAtomSet, useAtomValue } from '@effect/atom-react'
import { Schema } from 'effect'
import { emptyTrail, type LocalTrail } from '@/lib/tweet-nav-state'
import { persistedAtom } from './persistedAtom'

const StoredTrail = Schema.Struct({
  slugs: Schema.Array(Schema.String),
  cursor: Schema.Number
})

const { atom: tweetTrailAtom, write } = persistedAtom({
  key: 'gbfm-tweet-trail.json',
  schema: StoredTrail,
  fallback: emptyTrail
})

export { tweetTrailAtom }

export const useTweetTrail = (): LocalTrail => useAtomValue(tweetTrailAtom)

export const useUpdateTweetTrail = () => {
  const set = useAtomSet(tweetTrailAtom)

  return (next: (trail: LocalTrail) => LocalTrail) =>
    set((trail) => {
      const value = next(trail)
      if (value === trail) return trail
      write(value)
      return value
    })
}
