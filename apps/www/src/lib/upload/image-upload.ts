import { apiUrl, fetcher } from '@/lib/http'
import { parsePresignImageResponse } from './image-upload-response'

export interface ImageUploadResult {
  url: string
  key: string
}

// Images are a single PUT (no chunking/resumability, unlike the audio
// multipart flow in resumable-upload.ts) -- presign the key with the VPS
// (authenticated, via fetcher's credentials: 'include'), then PUT the raw
// bytes straight to S3. No credentials on the PUT itself: the presigned
// URL's signature is the only auth, matching resumable-upload.ts's
// putPartToS3.
export async function uploadImageDirectToS3(
  file: File,
  signal?: AbortSignal
): Promise<ImageUploadResult> {
  const raw = await fetcher<unknown>(apiUrl('/upload/image/presign'), {
    method: 'POST',
    body: JSON.stringify({
      fileName: file.name,
      contentType: file.type,
      fileSize: file.size
    }),
    signal
  })

  const { uploadUrl, publicUrl, key } = parsePresignImageResponse(raw)

  const putResponse = await fetch(uploadUrl, {
    method: 'PUT',
    body: file,
    headers: { 'Content-Type': file.type },
    signal
  })

  if (!putResponse.ok) {
    throw new Error(`Image upload to S3 failed (${putResponse.status})`)
  }

  return { url: publicUrl, key }
}
