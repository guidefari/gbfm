import type { ReadMode } from './read-mode'

type Directions = {
  readonly newer: string | null
  readonly older: string | null
  readonly olderUnread: string | null
}

export const tweetHref = (slug: string | null | undefined) =>
  slug ? `/tweet/${encodeURIComponent(slug)}` : null

/** Newer always walks back by date; Older skips seen tweets unless the reader wants everything. */
export const tweetLinks = (directions: Directions | null, readMode: ReadMode) => ({
  newer: tweetHref(directions?.newer),
  older: tweetHref(
    readMode === 'all' ? directions?.older : (directions?.olderUnread ?? directions?.older),
  ),
})
