import { describe, expect, test } from 'vitest'
import { parsePresignImageResponse } from './image-upload-response'

describe('parsePresignImageResponse', () => {
  test('decodes a valid presign payload', () => {
    expect(
      parsePresignImageResponse({
        uploadUrl: 'https://bucket.s3.amazonaws.com/key?X-Amz-Signature=abc',
        publicUrl: 'https://cdn.goosebumps.fm/user-content/key.png',
        key: 'user123/image/abc-def/artwork.png',
        expiresInSeconds: 300
      })
    ).toEqual({
      uploadUrl: 'https://bucket.s3.amazonaws.com/key?X-Amz-Signature=abc',
      publicUrl: 'https://cdn.goosebumps.fm/user-content/key.png',
      key: 'user123/image/abc-def/artwork.png',
      expiresInSeconds: 300
    })
  })

  test('throws on missing fields', () => {
    expect(() => parsePresignImageResponse({ key: 'k' })).toThrow()
  })

  test('throws on a non-object payload', () => {
    expect(() => parsePresignImageResponse(null)).toThrow()
  })
})
