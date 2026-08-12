import { afterEach, describe, expect, test, vi } from 'vitest'
import { HttpStatusError, uploadImageDirectToS3 } from './image-upload'
import { parsePresignImageResponse } from './image-upload-response'

describe('parsePresignImageResponse', () => {
  test('decodes valid image presign data and rejects malformed responses', () => {
    const response = {
      uploadUrl: 'https://bucket.s3.amazonaws.com/key?X-Amz-Signature=abc',
      publicUrl: 'https://cdn.goosebumps.fm/user-content/key.png',
      key: 'user123/image/abc-def/artwork.png',
      expiresInSeconds: 300
    }

    expect(parsePresignImageResponse(response)).toEqual(response)
    expect(() => parsePresignImageResponse({ key: 'k' })).toThrow()
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
  test('surfaces a permanent presign rejection without attempting an upload', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation(
        async () => new Response('File too large', { status: 413, statusText: 'Payload Too Large' })
      )
    vi.stubGlobal('fetch', fetchMock)

    const error = await uploadImageDirectToS3(makeFile()).catch((cause: unknown) => cause)

    expect(error).toBeInstanceOf(HttpStatusError)
    expect(error).toMatchObject({ status: 413 })
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  test('surfaces the S3 response status after a successful presign', async () => {
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
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[1]?.[0]).toBe(presignBody.uploadUrl)
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({ method: 'PUT' })
  })

  test('presigns and uploads an image before returning its public location', async () => {
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

    const file = makeFile()
    await expect(uploadImageDirectToS3(file)).resolves.toEqual({
      url: presignBody.publicUrl,
      key: presignBody.key
    })
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      '/api/upload/image/presign',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({
          fileName: 'artwork.png',
          contentType: 'image/png',
          fileSize: 3
        })
      })
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      presignBody.uploadUrl,
      expect.objectContaining({ method: 'PUT', body: file })
    )
  })
})
