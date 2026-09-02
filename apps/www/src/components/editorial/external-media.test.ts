import { Effect } from 'effect'
import { describe, expect, test } from 'vitest'
import {
  externalMediaEmbed,
  externalMediaMarkdown,
  parseBandcampOembedJson,
  parseExternalMediaUrl,
  parseExternalMediaUrlEffect
} from './external-media'

describe('parseExternalMediaUrl', () => {
  test.each([
    [
      'Spotify embedded track',
      'https://open.spotify.com/embed/track/4uLU6hMCjMI75M1A2tKUQC?si=shared',
      { provider: 'spotify', url: 'https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC' }
    ],
    [
      'Spotify international album',
      'https://open.spotify.com/intl-de/album/1ATL5GLyefJaxhQzSPVrLX',
      { provider: 'spotify', url: 'https://open.spotify.com/album/1ATL5GLyefJaxhQzSPVrLX' }
    ],
    [
      'SoundCloud mobile track',
      'https://m.soundcloud.com/artist-name/a-track?utm_source=clipboard',
      { provider: 'soundcloud', url: 'https://soundcloud.com/artist-name/a-track' }
    ],
    [
      'Bandcamp album',
      'https://artist-name.bandcamp.com/album/a-record?from=fanpub_fnb',
      { provider: 'bandcamp', url: 'https://artist-name.bandcamp.com/album/a-record' }
    ],
    [
      'YouTube short URL',
      'https://youtu.be/dQw4w9WgXcQ?si=shared',
      { provider: 'youtube', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }
    ],
    [
      'YouTube short',
      'https://www.youtube.com/shorts/dQw4w9WgXcQ',
      { provider: 'youtube', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }
    ]
  ])('normalizes $s', (_name, url, expected) => {
    expect(parseExternalMediaUrl(url)).toEqual({ ok: true, media: expected })
  })

  test('reports invalid runtime input through the Effect error channel', () => {
    const result = Effect.runSync(
      parseExternalMediaUrlEffect('javascript:alert(1)').pipe(
        Effect.match({
          onFailure: (error) => error,
          onSuccess: () => null
        })
      )
    )

    expect(result?._tag).toBe('ExternalMediaParseError')
  })

  test.each([
    ['an unsupported host', 'https://example.com/watch?v=dQw4w9WgXcQ'],
    ['a malformed Spotify ID', 'https://open.spotify.com/track/not-an-id'],
    ['a SoundCloud profile page', 'https://soundcloud.com/artist-name'],
    ['a non-video YouTube page', 'https://www.youtube.com/channel/channel-id'],
    ['an unsafe protocol', 'javascript:alert(1)']
  ])('rejects $s', (_name, url) => {
    expect(parseExternalMediaUrl(url)).toMatchObject({ ok: false })
  })
})

describe('externalMediaMarkdown', () => {
  test('serializes canonical media as stable MDX', () => {
    const parsed = parseExternalMediaUrl('https://youtu.be/dQw4w9WgXcQ')
    if (!parsed.ok) throw new Error(parsed.message)

    expect(externalMediaMarkdown(parsed.media)).toBe(
      '<ExternalMedia provider="youtube" url="https://www.youtube.com/watch?v=dQw4w9WgXcQ" />'
    )
  })
})

describe('externalMediaEmbed', () => {
  test('derives a SoundCloud iframe URL instead of trusting the source URL', () => {
    const parsed = parseExternalMediaUrl('https://soundcloud.com/artist-name/a-track')
    if (!parsed.ok) throw new Error(parsed.message)

    const embed = externalMediaEmbed(parsed.media)

    expect(embed?.provider).toBe('soundcloud')
    expect(embed?.src).toMatch(
      /^https:\/\/w\.soundcloud\.com\/player\/\?url=https%3A%2F%2Fsoundcloud\.com%2Fartist-name%2Fa-track/
    )
  })

  test('parses only an allow-listed Bandcamp player from oEmbed HTML', () => {
    const parsed = parseBandcampOembedJson(
      '{"html":"<iframe src=\\"https://bandcamp.com/EmbeddedPlayer/album=12345/size=large/\\"></iframe>"}'
    )
    if (!parsed.ok) throw new Error(parsed.message)

    expect(externalMediaEmbed(parsed.media)).toMatchObject({
      provider: 'bandcamp',
      src: 'https://bandcamp.com/EmbeddedPlayer/album=12345/size=large/bgcol=ffffff/linkcol=0687f5/tracklist=false/transparent=true/'
    })
  })
})
