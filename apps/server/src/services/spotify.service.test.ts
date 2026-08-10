import { describe, expect, test } from 'vitest'
import {
  cleanId,
  extractSpotifyId,
  extractYouTubeId,
  getIdFromSpotifyUrl,
  isAppleMusicUrl,
  isSpotifyUrl,
  isYouTubeUrl
} from './spotify.service'

describe('getIdFromSpotifyUrl', () => {
  test('extracts ID from Spotify URL with query params', () => {
    const url = 'https://open.spotify.com/track/4iV5W9uYEdYUVa79Axb7Rh?si=abc123'
    expect(getIdFromSpotifyUrl(url)).toBe('4iV5W9uYEdYUVa79Axb7Rh')
  })

  test('returns null for URL without query params', () => {
    const url = 'https://open.spotify.com/track/4iV5W9uYEdYUVa79Axb7Rh'
    expect(getIdFromSpotifyUrl(url)).toBeNull()
  })

  test('returns null for invalid URL', () => {
    expect(getIdFromSpotifyUrl('not-a-url')).toBeNull()
  })
})

describe('cleanId', () => {
  test('returns raw ID when not a URL', () => {
    expect(cleanId('4iV5W9uYEdYUVa79Axb7Rh')).toBe('4iV5W9uYEdYUVa79Axb7Rh')
  })

  test('extracts ID from encoded Spotify URL', () => {
    const encodedUrl = encodeURIComponent(
      'https://open.spotify.com/track/4iV5W9uYEdYUVa79Axb7Rh?si=abc'
    )
    expect(cleanId(encodedUrl)).toBe('4iV5W9uYEdYUVa79Axb7Rh')
  })

  test('returns ID unchanged for non-URL string', () => {
    expect(cleanId('abc123')).toBe('abc123')
  })
})

describe('isSpotifyUrl', () => {
  test('returns true for spotify.com URLs', () => {
    expect(isSpotifyUrl('https://open.spotify.com/track/123')).toBe(true)
    expect(isSpotifyUrl('https://spotify.com/album/456')).toBe(true)
  })

  test('returns true for spotify.link URLs', () => {
    expect(isSpotifyUrl('https://spotify.link/abc123')).toBe(true)
  })

  test('returns false for non-Spotify URLs', () => {
    expect(isSpotifyUrl('https://youtube.com/watch?v=123')).toBe(false)
    expect(isSpotifyUrl('https://example.com')).toBe(false)
  })
})

describe('isYouTubeUrl', () => {
  test('returns true for youtube.com URLs', () => {
    expect(isYouTubeUrl('https://youtube.com/watch?v=dQw4w9WgXcQ')).toBe(true)
    expect(isYouTubeUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(true)
  })

  test('returns true for youtu.be URLs', () => {
    expect(isYouTubeUrl('https://youtu.be/dQw4w9WgXcQ')).toBe(true)
  })

  test('returns false for non-YouTube URLs', () => {
    expect(isYouTubeUrl('https://spotify.com/track/123')).toBe(false)
    expect(isYouTubeUrl('https://vimeo.com/123')).toBe(false)
  })
})

describe('isAppleMusicUrl', () => {
  test('returns true for music.apple.com URLs', () => {
    expect(isAppleMusicUrl('https://music.apple.com/album/123')).toBe(true)
    expect(isAppleMusicUrl('https://music.apple.com/us/album/xyz')).toBe(true)
  })

  test('returns false for non-Apple Music URLs', () => {
    expect(isAppleMusicUrl('https://apple.com')).toBe(false)
    expect(isAppleMusicUrl('https://spotify.com/track/123')).toBe(false)
  })
})

describe('extractSpotifyId', () => {
  test('extracts track ID from Spotify URL', () => {
    expect(extractSpotifyId('https://open.spotify.com/track/4iV5W9uYEdYUVa79Axb7Rh')).toBe(
      '4iV5W9uYEdYUVa79Axb7Rh'
    )
  })

  test('extracts album ID from Spotify URL', () => {
    expect(extractSpotifyId('https://open.spotify.com/album/1DFixLWuPkv3KT3TnV35m3')).toBe(
      '1DFixLWuPkv3KT3TnV35m3'
    )
  })

  test('extracts playlist ID from Spotify URL', () => {
    expect(extractSpotifyId('https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M')).toBe(
      '37i9dQZF1DXcBWIGoYBM5M'
    )
  })

  test('extracts ID from spotify.link URL', () => {
    expect(extractSpotifyId('https://spotify.link/abc123xyz')).toBe('abc123xyz')
  })

  test('extracts ID from URL with query params', () => {
    expect(
      extractSpotifyId('https://open.spotify.com/track/4iV5W9uYEdYUVa79Axb7Rh?si=abc123')
    ).toBe('4iV5W9uYEdYUVa79Axb7Rh')
  })

  test('returns null for non-Spotify URL', () => {
    expect(extractSpotifyId('https://youtube.com/watch?v=123')).toBeNull()
  })

  test('returns null for invalid Spotify URL', () => {
    expect(extractSpotifyId('https://spotify.com/invalid/path')).toBeNull()
  })
})

describe('extractYouTubeId', () => {
  test('extracts ID from youtube.com/watch URL', () => {
    expect(extractYouTubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
  })

  test('extracts ID from youtu.be short URL', () => {
    expect(extractYouTubeId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
  })

  test('extracts ID from embed URL', () => {
    expect(extractYouTubeId('https://youtube.com/embed/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
  })

  test('extracts ID with additional query params', () => {
    expect(extractYouTubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=30')).toBe('dQw4w9WgXcQ')
  })

  test('handles IDs with hyphens and underscores', () => {
    expect(extractYouTubeId('https://youtu.be/abc-123_XYZ')).toBe('abc-123_XYZ')
  })

  test('returns null for non-YouTube URL', () => {
    expect(extractYouTubeId('https://vimeo.com/123456')).toBeNull()
  })

  test('returns null for invalid YouTube URL', () => {
    expect(extractYouTubeId('https://youtube.com/channel/abc')).toBeNull()
  })
})
