import { Effect } from 'effect'
import { FetchError } from '@/errors'
import type { S3Service } from '@/services/s3.service'

const MAX_MUSIC_COVER_IMAGE_SIZE = 10 * 1024 * 1024

const APPROVED_MUSIC_ARTWORK_HOSTS = new Set([
  'archive.org',
  'coverartarchive.org',
  'i.scdn.co',
  'images-na.ssl-images-amazon.com',
  'img.youtube.com',
  'm.media-amazon.com',
  'mosaic.scdn.co',
  'resources.tidal.com'
])

const APPROVED_MUSIC_ARTWORK_HOST_SUFFIXES = [
  '.archive.org',
  '.bcbits.com',
  '.dzcdn.net',
  '.mzstatic.com',
  '.sndcdn.com',
  '.spotifycdn.com',
  '.ytimg.com'
]

const APPROVED_MUSIC_ARTWORK_CONTENT_TYPES = new Set([
  'image/avif',
  'image/gif',
  'image/jpeg',
  'image/png',
  'image/webp'
])

export type MusicCoverImageFetch = (
  input: string | URL | Request,
  init?: RequestInit
) => Promise<Response>

export const isApprovedMusicArtworkUrl = (source: string): boolean => {
  const url = URL.parse(source)
  if (!url || url.protocol !== 'https:') return false

  const hostname = url.hostname.toLowerCase()
  return (
    APPROVED_MUSIC_ARTWORK_HOSTS.has(hostname) ||
    APPROVED_MUSIC_ARTWORK_HOST_SUFFIXES.some((suffix) => hostname.endsWith(suffix))
  )
}

const readResponseBody = async (response: Response): Promise<Uint8Array> => {
  if (!response.body) throw new Error('Music cover image response has no body')

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0

  try {
    while (true) {
      const result = await reader.read()
      if (result.done) break

      size += result.value.byteLength
      if (size > MAX_MUSIC_COVER_IMAGE_SIZE) {
        await reader.cancel()
        throw new Error('Music cover image exceeds the maximum size')
      }
      chunks.push(result.value)
    }
  } finally {
    reader.releaseLock()
  }

  if (size === 0) throw new Error('Music cover image response is empty')

  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return bytes
}

export const copyMusicCoverImageEffect = (
  s3: Pick<S3Service, 'uploadFile'>,
  cdnUrl: string,
  bucketName: string,
  entityType: string,
  entityId: string,
  coverImageUrl: string,
  fetcher: MusicCoverImageFetch = fetch
) =>
  Effect.gen(function* () {
    if (!isApprovedMusicArtworkUrl(coverImageUrl)) return null

    const response = yield* Effect.tryPromise({
      try: () => fetcher(coverImageUrl, { redirect: 'follow' }),
      catch: (cause) => new FetchError({ message: `Failed to fetch ${coverImageUrl}`, cause })
    })

    if (!response.ok || (response.url && !isApprovedMusicArtworkUrl(response.url))) return null

    const contentType = response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase()
    if (!contentType || !APPROVED_MUSIC_ARTWORK_CONTENT_TYPES.has(contentType)) return null

    const contentLength = Number(response.headers.get('content-length'))
    if (Number.isFinite(contentLength) && contentLength > MAX_MUSIC_COVER_IMAGE_SIZE) return null

    const bytes = yield* Effect.tryPromise({
      try: () => readResponseBody(response),
      catch: (cause) => new FetchError({ message: `Failed to read ${coverImageUrl}`, cause })
    })
    const key = `music/${entityType}/${entityId}/cover`
    const uploadedKey = yield* s3.uploadFile(key, bytes, contentType, bucketName)
    return `${cdnUrl}/user-content/${uploadedKey}`
  }).pipe(Effect.catchTag('FetchError', () => Effect.succeed(null)))

// Bulk import paths copy many covers, so one unwritable object should not
// abort the run. The interactive resolve handler deliberately does not use
// this: there a failed upload means the URL it is about to store points at an
// object that was never written.
export const copyMusicCoverImageBestEffort = (
  ...args: Parameters<typeof copyMusicCoverImageEffect>
) => copyMusicCoverImageEffect(...args).pipe(Effect.catchTag('S3Error', () => Effect.succeed(null)))
