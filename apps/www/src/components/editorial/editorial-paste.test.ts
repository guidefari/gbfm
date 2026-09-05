import { Effect } from 'effect'
import { expect, test } from 'vitest'
import {
  parsePendingMusicEntityEffect,
  transformPastedEditorialContentEffect
} from './editorial-paste'

const transform = (value: string) => Effect.runSync(transformPastedEditorialContentEffect(value))

test('transforms standalone Spotify URLs, deduplicates resolution, and parses pending entities', () => {
  const url = 'https://open.spotify.com/album/6AwBhTb30oRIH35Og6SdKG'
  const otherUrl = 'https://open.spotify.com/album/1tLBaM7LWJkX1zi3K6wuLu'
  const result = transform(`${url}?si=shared\n\n${url}\n\n${otherUrl}`)

  expect(result).toEqual({
    content: `<MusicEntityPending url="${url}" />\n\n<MusicEntityPending url="${url}" />\n\n<MusicEntityPending url="${otherUrl}" />`,
    spotifyUrls: [url, otherUrl]
  })
  const [pending] = result.content.split('\n\n')
  expect(Effect.runSync(parsePendingMusicEntityEffect(pending))).toEqual({
    provider: 'spotify',
    url,
    fallback: 'restore-url'
  })
})

test('preserves inline links and places their entities before the following paragraph', () => {
  const input = `Listen to [Inner River](https://open.spotify.com/album/1BIXNamH3zTLBSb3my28k6?si=shared) again.

The next thought stays below the entity.`

  expect(transform(input)).toEqual({
    content: `Listen to [Inner River](https://open.spotify.com/album/1BIXNamH3zTLBSb3my28k6?si=shared) again.

<MusicEntityPending url="https://open.spotify.com/album/1BIXNamH3zTLBSb3my28k6" fallback="remove" />

The next thought stays below the entity.`,
    spotifyUrls: ['https://open.spotify.com/album/1BIXNamH3zTLBSb3my28k6']
  })
})

test('does not transform URLs inside fenced code', () => {
  const input = `\`\`\`
https://open.spotify.com/album/6AwBhTb30oRIH35Og6SdKG
\`\`\``

  expect(transform(input)).toEqual({ content: input, spotifyUrls: [] })
})

test('rejects hand-written unsafe pending values', () => {
  const parsed = Effect.runSync(
    Effect.option(parsePendingMusicEntityEffect('<MusicEntityPending url="javascript:alert(1)" />'))
  )

  expect(parsed._tag).toBe('None')
})
