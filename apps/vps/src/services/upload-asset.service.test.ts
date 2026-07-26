import { describe, expect, test } from 'vitest'
import { keyFromAssetUrl } from './upload-asset.service'

describe('keyFromAssetUrl', () => {
  const bucketRouterUrl = 'https://cdn.goosebumps.fm'

  test('strips the bucket router prefix to recover the raw S3 key', () => {
    expect(
      keyFromAssetUrl(
        'https://cdn.goosebumps.fm/user-content/user123/image/abc-def/artwork.png',
        bucketRouterUrl
      )
    ).toBe('user123/image/abc-def/artwork.png')
  })

  test('returns null for a URL from a different host', () => {
    expect(keyFromAssetUrl('https://example.com/user-content/key.png', bucketRouterUrl)).toBeNull()
  })

  test('returns null for a URL missing the /user-content/ path segment', () => {
    expect(keyFromAssetUrl('https://cdn.goosebumps.fm/mixes/key.mp3', bucketRouterUrl)).toBeNull()
  })

  test('returns null for an empty string', () => {
    expect(keyFromAssetUrl('', bucketRouterUrl)).toBeNull()
  })
})
