import { afterEach, describe, expect, test, vi } from 'vitest'
import { HttpStatusError, uploadImageDirectToS3 } from './image-upload'
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

describe('uploadImageDirectToS3', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  const makeFile = () => new File(['abc'], 'artwork.png', { type: 'image/png' })

  // Regression coverage for the retry-classification bug: a permanent 4xx
  // from presign (file too large, bad content-type) must surface a status
  // so isPageRetryable in -program.ts can fail fast instead of retrying
  // RETRY_TIMES and re-presigning (orphaning pending upload_assets rows).
  test('throws HttpStatusError carrying the presign response status on a 4xx', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation(
        async () => new Response('File too large', { status: 413, statusText: 'Payload Too Large' })
      )
    vi.stubGlobal('fetch', fetchMock)

    await expect(uploadImageDirectToS3(makeFile())).rejects.toBeInstanceOf(HttpStatusError)
    await expect(uploadImageDirectToS3(makeFile())).rejects.toMatchObject({ status: 413 })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  test('throws HttpStatusError carrying the S3 PUT response status on a failed upload', async () => {
    const presignBody = {
      uploadUrl: 'https://bucket.s3.amazonaws.com/key?X-Amz-Signature=abc',
      publicUrl: 'https://cdn.goosebumps.fm/user-content/key.png',
      key: 'user123/image/abc-def/artwork.png',
      expiresInSeconds: 300
    }
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(presignBody), { status: 200 }))
      .mockResolvedValueOnce(new Response('', { status: 500, statusText: 'Internal Server Error' }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(uploadImageDirectToS3(makeFile())).rejects.toMatchObject({ status: 500 })
  })

  test('resolves with the public URL and key on success', async () => {
    const presignBody = {
      uploadUrl: 'https://bucket.s3.amazonaws.com/key?X-Amz-Signature=abc',
      publicUrl: 'https://cdn.goosebumps.fm/user-content/key.png',
      key: 'user123/image/abc-def/artwork.png',
      expiresInSeconds: 300
    }
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(presignBody), { status: 200 }))
      .mockResolvedValueOnce(new Response('', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(uploadImageDirectToS3(makeFile())).resolves.toEqual({
      url: presignBody.publicUrl,
      key: presignBody.key
    })
  })
})
