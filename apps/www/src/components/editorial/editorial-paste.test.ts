import { Effect } from 'effect'
import { describe, expect, test } from 'vitest'
import {
  parsePendingMusicEntityEffect,
  transformPastedEditorialContentEffect
} from './editorial-paste'

const transform = (value: string) => Effect.runSync(transformPastedEditorialContentEffect(value))

describe('transformPastedEditorialContentEffect', () => {
  test('turns standalone Spotify URLs into pending music entities', () => {
    const input = `First album
https://open.spotify.com/album/6AwBhTb30oRIH35Og6SdKG?si=shared

Second album
https://open.spotify.com/album/1tLBaM7LWJkX1zi3K6wuLu?si=shared`

    expect(transform(input)).toEqual({
      content: `First album
<MusicEntityPending url="https://open.spotify.com/album/6AwBhTb30oRIH35Og6SdKG" />

Second album
<MusicEntityPending url="https://open.spotify.com/album/1tLBaM7LWJkX1zi3K6wuLu" />`,
      spotifyUrls: [
        'https://open.spotify.com/album/6AwBhTb30oRIH35Og6SdKG',
        'https://open.spotify.com/album/1tLBaM7LWJkX1zi3K6wuLu'
      ]
    })
  })

  test('deduplicates URLs before batch resolution', () => {
    const url = 'https://open.spotify.com/album/6AwBhTb30oRIH35Og6SdKG'

    expect(transform(`${url}\n\n${url}`).spotifyUrls).toEqual([url])
  })

  test('preserves Spotify links used inside prose', () => {
    const input =
      'Listen to [Inner River](https://open.spotify.com/album/1BIXNamH3zTLBSb3my28k6?si=shared) again.'

    expect(transform(input)).toEqual({ content: input, spotifyUrls: [] })
  })

  test('does not transform URLs inside fenced code', () => {
    const input = `\`\`\`
https://open.spotify.com/album/6AwBhTb30oRIH35Og6SdKG
\`\`\``

    expect(transform(input)).toEqual({ content: input, spotifyUrls: [] })
  })
})

describe('parsePendingMusicEntityEffect', () => {
  test('parses generated pending entities', () => {
    const parsed = Effect.runSync(
      parsePendingMusicEntityEffect(
        '<MusicEntityPending url="https://open.spotify.com/album/6AwBhTb30oRIH35Og6SdKG" />'
      )
    )

    expect(parsed).toEqual({
      provider: 'spotify',
      url: 'https://open.spotify.com/album/6AwBhTb30oRIH35Og6SdKG'
    })
  })

  test('rejects hand-written unsafe pending values', () => {
    const parsed = Effect.runSync(
      Effect.option(
        parsePendingMusicEntityEffect('<MusicEntityPending url="javascript:alert(1)" />')
      )
    )

    expect(parsed._tag).toBe('None')
  })
})
