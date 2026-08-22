import { describe, expect, test } from 'vitest'
import { canonicalizeMusicSourceLink } from './music-source-url'

describe('canonicalizeMusicSourceLink', () => {
  test.each([
    [
      'https://open.spotify.com/track/4iV5W9uYEdYUVa79Axb7Rh?si=tracking',
      { platform: 'spotify', url: 'https://open.spotify.com/track/4iV5W9uYEdYUVa79Axb7Rh' }
    ],
    [
      'https://www.deezer.com/us/album/302127?utm_source=share',
      { platform: 'deezer', url: 'https://www.deezer.com/album/302127' }
    ],
    [
      'https://deezer.com/playlist/908622995?utm_source=share',
      { platform: 'deezer', url: 'https://www.deezer.com/playlist/908622995' }
    ],
    [
      'https://youtu.be/dQw4w9WgXcQ?feature=share',
      { platform: 'youtube', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }
    ],
    [
      'https://www.youtube.com/embed/dQw4w9WgXcQ',
      { platform: 'youtube', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }
    ]
  ])('canonicalizes %s', (source, expected) => {
    expect(canonicalizeMusicSourceLink(source)).toEqual(expected)
  })

  test('does not mistake lookalike hosts for supported sources', () => {
    expect(canonicalizeMusicSourceLink('https://notspotify.com/track/123')).toEqual({
      platform: 'other',
      url: 'https://notspotify.com/track/123'
    })
    expect(canonicalizeMusicSourceLink('https://notdeezer.com/track/123')).toEqual({
      platform: 'other',
      url: 'https://notdeezer.com/track/123'
    })
  })

  test('preserves malformed input as an unsupported source', () => {
    expect(canonicalizeMusicSourceLink('not a URL')).toEqual({
      platform: 'other',
      url: 'not a URL'
    })
  })
})
