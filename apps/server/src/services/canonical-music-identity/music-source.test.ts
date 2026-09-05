import { Effect } from 'effect'
import { describe, expect, test } from 'vitest'
import { parseMusicSource } from './music-source'

const parse = (source: string, expectedType?: 'artist' | 'album' | 'track' | 'playlist') =>
  Effect.runPromise(parseMusicSource(source, expectedType))

const parseError = (source: string, expectedType?: 'artist' | 'album' | 'track' | 'playlist') =>
  Effect.runPromise(Effect.flip(parseMusicSource(source, expectedType)))

describe('parseMusicSource', () => {
  test.each([
    'https://open.spotify.com/track/4iV5W9uYEdYUVa79Axb7Rh',
    'https://play.spotify.com/track/4iV5W9uYEdYUVa79Axb7Rh?si=session&utm_source=test#player',
    'https://open.spotify.com/intl-de/track/4iV5W9uYEdYUVa79Axb7Rh',
    'https://open.spotify.com/embed/track/4iV5W9uYEdYUVa79Axb7Rh'
  ])('derives one key from Spotify variants', async (source) => {
    await expect(parse(source, 'track')).resolves.toMatchObject({
      sourceKey: 'spotify:track:4iV5W9uYEdYUVa79Axb7Rh',
      platform: 'spotify',
      sourceEntityType: 'track',
      externalId: '4iV5W9uYEdYUVa79Axb7Rh',
      canonicalUrl: 'https://open.spotify.com/track/4iV5W9uYEdYUVa79Axb7Rh'
    })
  })

  test.each([
    'https://www.deezer.com/album/302127',
    'https://deezer.com/en/album/302127?utm_medium=share',
    'https://m.deezer.com/us/album/302127#details'
  ])('derives one key from Deezer variants', async (source) => {
    await expect(parse(source, 'album')).resolves.toMatchObject({
      sourceKey: 'deezer:album:302127',
      canonicalUrl: 'https://www.deezer.com/album/302127'
    })
  })

  test.each([
    'https://youtu.be/dQw4w9WgXcQ',
    'https://www.youtube.com/watch?utm_source=test&v=dQw4w9WgXcQ',
    'https://music.youtube.com/embed/dQw4w9WgXcQ?si=session',
    'https://youtube.com/shorts/dQw4w9WgXcQ'
  ])('derives one key from YouTube video variants', async (source) => {
    await expect(parse(source, 'track')).resolves.toMatchObject({
      sourceKey: 'youtube:video:dQw4w9WgXcQ',
      platform: 'youtube',
      sourceEntityType: 'video',
      canonicalUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
    })
  })

  test('canonicalization is idempotent', async () => {
    const first = await parse(
      'https://play.spotify.com/album/1BIXNamH3zTLBSb3my28k6?si=session#player',
      'album'
    )
    const second = await parse(first.canonicalUrl, 'album')
    const third = await parse(second.canonicalUrl, 'album')

    expect(second).toEqual(third)
    expect(second.sourceKey).toBe(first.sourceKey)
  })

  test('removes tracking parameters and sorts identity-bearing parameters', async () => {
    const first = await parse('https://example.com/release?b=2&utm_source=test&a=1#section')
    const second = await parse('https://example.com/release?a=1&b=2&fbclid=tracking')

    expect(first).toEqual(second)
    expect(first.normalizedUrl).toBe('https://example.com/release?a=1&b=2')
  })

  test('preserves unknown parameters in generic source identity', async () => {
    const first = await parse('https://example.com/release?edition=deluxe')
    const second = await parse('https://example.com/release?edition=standard')

    expect(first.sourceKey).not.toBe(second.sourceKey)
  })

  test.each([
    ['http://example.com/track', 'unsupported_protocol'],
    ['https://user:password@example.com/track', 'credentials'],
    ['https://127.0.0.1/track', 'unsafe_destination'],
    ['https://10.0.0.2/track', 'unsafe_destination'],
    ['https://[::1]/track', 'unsafe_destination'],
    ['https://metadata.google.internal/latest/meta-data', 'unsafe_destination'],
    ['https://open.spotify.com.evil.example/track/abc', 'unsafe_destination'],
    ['https://open.spotify.com/not-a-type/abc', 'invalid_provider_source'],
    ['https://example.com/track\n', 'control_character']
  ])('rejects unsafe or invalid input %#', async (source, reason) => {
    await expect(parseError(source)).resolves.toMatchObject({ reason })
  })

  test('rejects oversized source URLs', async () => {
    await expect(parseError(`https://example.com/${'a'.repeat(2048)}`)).resolves.toMatchObject({
      reason: 'too_long'
    })
  })

  test('rejects provider type mismatches before provider work', async () => {
    await expect(
      parseError('https://open.spotify.com/album/1BIXNamH3zTLBSb3my28k6', 'track')
    ).resolves.toMatchObject({ reason: 'type_mismatch' })
    await expect(
      parseError('https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'playlist')
    ).resolves.toMatchObject({ reason: 'type_mismatch' })
  })
})
