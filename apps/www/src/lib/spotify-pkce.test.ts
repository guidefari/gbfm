import { describe, expect, it } from 'vitest'
import { spotifyEntityFromUrl, spotifyIdFromUrl, spotifyUriFromUrl } from './spotify-pkce'

describe('spotifyEntityFromUrl', () => {
  it('parses track, album, and playlist urls', () => {
    expect(spotifyEntityFromUrl('https://open.spotify.com/track/4iV5W9uYEdYUVa79Axb7Rh')).toEqual({
      kind: 'track',
      id: '4iV5W9uYEdYUVa79Axb7Rh',
      uri: 'spotify:track:4iV5W9uYEdYUVa79Axb7Rh'
    })

    expect(spotifyEntityFromUrl('https://open.spotify.com/album/1DFixLWuPkv3KT3TnV35m3')).toEqual({
      kind: 'album',
      id: '1DFixLWuPkv3KT3TnV35m3',
      uri: 'spotify:album:1DFixLWuPkv3KT3TnV35m3'
    })

    expect(
      spotifyEntityFromUrl('https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M')
    ).toEqual({
      kind: 'playlist',
      id: '37i9dQZF1DXcBWIGoYBM5M',
      uri: 'spotify:playlist:37i9dQZF1DXcBWIGoYBM5M'
    })
  })

  it('handles localized urls and query strings', () => {
    expect(
      spotifyEntityFromUrl('https://open.spotify.com/intl-pt/album/1DFixLWuPkv3KT3TnV35m3?si=abc')
    ).toEqual({
      kind: 'album',
      id: '1DFixLWuPkv3KT3TnV35m3',
      uri: 'spotify:album:1DFixLWuPkv3KT3TnV35m3'
    })
  })

  it('parses bare spotify uris', () => {
    expect(spotifyEntityFromUrl('spotify:track:4iV5W9uYEdYUVa79Axb7Rh')?.kind).toBe('track')
  })

  it('returns null for unsupported entities and non-spotify urls', () => {
    expect(
      spotifyEntityFromUrl('https://open.spotify.com/artist/0OdUWJ0sBjDrqHygGUXeCF')
    ).toBeNull()
    expect(spotifyEntityFromUrl('https://bandcamp.com/track/whatever')).toBeNull()
    expect(spotifyEntityFromUrl('')).toBeNull()
  })
})

describe('track-only helpers stay track-only', () => {
  it('resolves track urls', () => {
    expect(spotifyUriFromUrl('https://open.spotify.com/track/4iV5W9uYEdYUVa79Axb7Rh')).toBe(
      'spotify:track:4iV5W9uYEdYUVa79Axb7Rh'
    )
    expect(spotifyIdFromUrl('https://open.spotify.com/track/4iV5W9uYEdYUVa79Axb7Rh')).toBe(
      '4iV5W9uYEdYUVa79Axb7Rh'
    )
  })

  it('rejects albums and playlists so playlist import keeps its contract', () => {
    const album = 'https://open.spotify.com/album/1DFixLWuPkv3KT3TnV35m3'
    expect(spotifyUriFromUrl(album)).toBeNull()
    expect(spotifyIdFromUrl(album)).toBeNull()
  })
})
