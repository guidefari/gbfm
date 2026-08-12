// Imports apiUrl from http-url.ts directly rather than the @/lib/http
// barrel: the barrel pulls in api-client.ts, which reads `window` at module
// scope, so importing it (even without using the hooks) crashes any
// non-browser test environment. http-url.ts only touches `window` lazily
// inside functions this module never calls.
import { apiUrl } from '@/lib/http-url'
import { parsePresignImageResponse } from './image-upload-response'

export interface ImageUploadResult {
  url: string
  key: string
}

// Carries the failed response's HTTP status so callers (isPageRetryable)
// can tell permanent 4xx failures (file too large, bad content-type) apart
// from transient ones -- retrying a 4xx would just re-presign and orphan
// the previous pending upload_assets row.
export class HttpStatusError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'HttpStatusError'
    this.status = status
  }
}

// Images are a single PUT (no chunking/resumability, unlike the audio
// multipart flow in resumable-upload.ts) -- presign the key with the VPS
// (authenticated, via credentials: 'include'), then PUT the raw bytes
// straight to S3. No credentials on the PUT itself: the presigned URL's
// signature is the only auth, matching resumable-upload.ts's putPartToS3.
// Uses raw fetch instead of the shared fetcher() so the Response is
// available directly for both requests and every failure can carry a
// concrete status, mirroring services/resumable-upload/service.ts's
// httpRequest.
export async function uploadImageDirectToS3(
  file: File,
  signal?: AbortSignal
): Promise<ImageUploadResult> {
  const presignResponse = await fetch(apiUrl('/upload/image/presign'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      fileName: file.name,
      contentType: file.type,
      fileSize: file.size
    }),
    signal
  })

  if (!presignResponse.ok) {
    const errorText = await presignResponse.text()
    throw new HttpStatusError(
      presignResponse.status,
      `Image presign failed (${presignResponse.status}): ${errorText || presignResponse.statusText}`
    )
  }

  const raw = await presignResponse.json()
  const { uploadUrl, publicUrl, key } = parsePresignImageResponse(raw)

  const putResponse = await fetch(uploadUrl, {
    method: 'PUT',
    body: file,
    headers: { 'Content-Type': file.type },
    signal
  })

  if (!putResponse.ok) {
    throw new HttpStatusError(
      putResponse.status,
      `Image upload to S3 failed (${putResponse.status})`
    )
  }

  return { url: publicUrl, key }
}
