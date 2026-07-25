import { describe, expect, it } from 'vitest'
import { spotifyEntityFromUrl, spotifyIdFromUrl, spotifyUriFromUrl } from './index'

describe('spotifyEntityFromUrl', () => {
  it('parses track urls', () => {
    const result = spotifyEntityFromUrl('https://open.spotify.com/track/4iV5W9uYEdYUVa79Axb7Rh')
    expect(result).toEqual({
      kind: 'track',
      id: '4iV5W9uYEdYUVa79Axb7Rh',
      uri: 'spotify:track:4iV5W9uYEdYUVa79Axb7Rh'
    })
  })

  it('parses album urls', () => {
    const result = spotifyEntityFromUrl('https://open.spotify.com/album/1DFixLWuPkv3KT3TnV35m3')
    expect(result).toEqual({
      kind: 'album',
      id: '1DFixLWuPkv3KT3TnV35m3',
      uri: 'spotify:album:1DFixLWuPkv3KT3TnV35m3'
    })
  })

  it('parses playlist urls', () => {
    const result = spotifyEntityFromUrl('https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M')
    expect(result).toEqual({
      kind: 'playlist',
      id: '37i9dQZF1DXcBWIGoYBM5M',
      uri: 'spotify:playlist:37i9dQZF1DXcBWIGoYBM5M'
    })
  })

  it('handles localized intl- urls and query strings', () => {
    const result = spotifyEntityFromUrl(
      'https://open.spotify.com/intl-pt/album/1DFixLWuPkv3KT3TnV35m3?si=abc'
    )
    expect(result).toEqual({
      kind: 'album',
      id: '1DFixLWuPkv3KT3TnV35m3',
      uri: 'spotify:album:1DFixLWuPkv3KT3TnV35m3'
    })
  })

  it('parses bare spotify uris', () => {
    const result = spotifyEntityFromUrl('spotify:track:4iV5W9uYEdYUVa79Axb7Rh')
    expect(result).toEqual({
      kind: 'track',
      id: '4iV5W9uYEdYUVa79Axb7Rh',
      uri: 'spotify:track:4iV5W9uYEdYUVa79Axb7Rh'
    })
  })

  it('parses bare spotify uris for albums and playlists', () => {
    expect(spotifyEntityFromUrl('spotify:album:1DFixLWuPkv3KT3TnV35m3')).toEqual({
      kind: 'album',
      id: '1DFixLWuPkv3KT3TnV35m3',
      uri: 'spotify:album:1DFixLWuPkv3KT3TnV35m3'
    })
    expect(spotifyEntityFromUrl('spotify:playlist:37i9dQZF1DXcBWIGoYBM5M')).toEqual({
      kind: 'playlist',
      id: '37i9dQZF1DXcBWIGoYBM5M',
      uri: 'spotify:playlist:37i9dQZF1DXcBWIGoYBM5M'
    })
  })

  it('returns null for unsupported entity kinds', () => {
    const result = spotifyEntityFromUrl('https://open.spotify.com/artist/0OdUWJ0sBjDrqHygGUXeCF')
    expect(result).toBeNull()
  })

  it('returns null for non-spotify urls', () => {
    const result = spotifyEntityFromUrl('https://bandcamp.com/track/whatever')
    expect(result).toBeNull()
  })

  it('returns null for empty input', () => {
    const result = spotifyEntityFromUrl('')
    expect(result).toBeNull()
  })

  it('returns null for garbage input', () => {
    const result = spotifyEntityFromUrl('not a url at all, just some text')
    expect(result).toBeNull()
  })

  it('returns null for a malformed spotify uri missing an id', () => {
    const result = spotifyEntityFromUrl('spotify:track:')
    expect(result).toBeNull()
  })
})

describe('track-only helpers stay track-only', () => {
  it('resolves track urls to a uri', () => {
    const result = spotifyUriFromUrl('https://open.spotify.com/track/4iV5W9uYEdYUVa79Axb7Rh')
    expect(result).toBe('spotify:track:4iV5W9uYEdYUVa79Axb7Rh')
  })

  it('resolves track urls to an id', () => {
    const result = spotifyIdFromUrl('https://open.spotify.com/track/4iV5W9uYEdYUVa79Axb7Rh')
    expect(result).toBe('4iV5W9uYEdYUVa79Axb7Rh')
  })

  it('rejects albums so playlist import keeps its contract', () => {
    const album = 'https://open.spotify.com/album/1DFixLWuPkv3KT3TnV35m3'
    expect(spotifyUriFromUrl(album)).toBeNull()
    expect(spotifyIdFromUrl(album)).toBeNull()
  })

  it('rejects playlists so playlist import keeps its contract', () => {
    const playlist = 'https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M'
    expect(spotifyUriFromUrl(playlist)).toBeNull()
    expect(spotifyIdFromUrl(playlist)).toBeNull()
  })
})
