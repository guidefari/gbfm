import { Effect } from 'effect'
import { describe, expect, test } from 'vitest'
import {
  parseSpotifyEmbedMarkdownEffect,
  transformPastedEditorialContentEffect
} from './editorial-paste'

const transform = (value: string) => Effect.runSync(transformPastedEditorialContentEffect(value))

describe('transformPastedEditorialContentEffect', () => {
  test('turns standalone Spotify URLs into stable rich media blocks', () => {
    const input = `First album
https://open.spotify.com/album/6AwBhTb30oRIH35Og6SdKG?si=shared

Second album
https://open.spotify.com/album/1tLBaM7LWJkX1zi3K6wuLu?si=shared`

    expect(transform(input)).toBe(`First album
<ExternalMedia provider="spotify" url="https://open.spotify.com/album/6AwBhTb30oRIH35Og6SdKG" />

Second album
<ExternalMedia provider="spotify" url="https://open.spotify.com/album/1tLBaM7LWJkX1zi3K6wuLu" />`)
  })

  test('preserves Spotify links used inside prose', () => {
    const input =
      'Listen to [Inner River](https://open.spotify.com/album/1BIXNamH3zTLBSb3my28k6?si=shared) again.'

    expect(transform(input)).toBe(input)
  })

  test('does not transform URLs inside fenced code', () => {
    const input = `\`\`\`
https://open.spotify.com/album/6AwBhTb30oRIH35Og6SdKG
\`\`\``

    expect(transform(input)).toBe(input)
  })
})

describe('parseSpotifyEmbedMarkdownEffect', () => {
  test('parses generated Spotify blocks', () => {
    const parsed = Effect.runSync(
      parseSpotifyEmbedMarkdownEffect(
        '<ExternalMedia provider="spotify" url="https://open.spotify.com/album/6AwBhTb30oRIH35Og6SdKG" />'
      )
    )

    expect(parsed).toEqual({
      provider: 'spotify',
      url: 'https://open.spotify.com/album/6AwBhTb30oRIH35Og6SdKG'
    })
  })

  test('rejects hand-written unsafe embed values', () => {
    const parsed = Effect.runSync(
      Effect.option(
        parseSpotifyEmbedMarkdownEffect(
          '<ExternalMedia provider="spotify" url="javascript:alert(1)" />'
        )
      )
    )

    expect(parsed._tag).toBe('None')
  })
})
