import { describe, expect, test } from 'vitest'

import { convertLegacyMdxFragment } from './legacy-mdx'

describe('migration-only legacy JSX conversion', () => {
  test.each([
    [
      'Track',
      '<Track url="https://open.spotify.com/track/abc" genres={["dnb", "jungle"]} />',
      '::track',
    ],
    ['Album', '<Album url="https://open.spotify.com/album/abc" />', '::album'],
    ['Playlist', '<Playlist url="https://open.spotify.com/playlist/abc" />', '::playlist'],
    ['MusicEntity', '<MusicEntity type="album" id="catalog-id" showTracks={false} />', '::music'],
    ['YoutubeEmbed', '<YoutubeEmbed videoId="abc" />', '::media'],
    [
      'ExternalMedia',
      '<ExternalMedia provider="soundcloud" url="https://soundcloud.com/a/b" />',
      '::media',
    ],
    ['Tracklist', '<Tracklist tracks={["Artist - One", "Artist - Two"]} />', ':::tracklist'],
    [
      'HorizontalScrollCards',
      '<HorizontalScrollCards>\n<Track url="https://open.spotify.com/track/abc" />\n</HorizontalScrollCards>',
      ':::cards',
    ],
  ])('converts %s literal syntax', (component, source, prefix) => {
    const result = convertLegacyMdxFragment(source)
    expect(result).toMatchObject({ component })
    expect('canonical' in result ? result.canonical.startsWith(prefix) : false).toBe(true)
  })

  test('expands production-shaped Spotify IDs to portable URLs', () => {
    const result = convertLegacyMdxFragment(
      `<Track
  url={'2Mf7lfHxdiABiO7j0BDbHc'}
  genres={['experimental']}
  blurb="Lacks music is very good. Clean, well constructed bass."
/>`,
    )

    expect(result).toEqual({
      component: 'Track',
      canonical:
        '::track{url="https://open.spotify.com/track/2Mf7lfHxdiABiO7j0BDbHc" genres="experimental" blurb="Lacks music is very good. Clean, well constructed bass."}',
    })
  })

  test.each([
    '<Track {...props} />',
    '<Track url={value} />',
    '<Track url={getUrl()} />',
    '<Track onClick="oops" url="https://open.spotify.com/track/abc" />',
    '<Unknown value="x" />',
    '<MusicEntityPending type="track" id="x" />',
  ])('rejects nonliteral or unknown syntax', (source) => {
    expect(convertLegacyMdxFragment(source)).toHaveProperty('reason')
  })

  test('returns a typed failure for malformed external URLs', () => {
    expect(convertLegacyMdxFragment('<ExternalMedia url="not-a-url" />')).toEqual({
      reason: 'ExternalMedia URL is malformed',
    })
  })
})
