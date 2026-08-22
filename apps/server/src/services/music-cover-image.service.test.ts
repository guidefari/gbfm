import { Effect, Exit } from 'effect'
import { describe, expect, test, vi } from 'vitest'
import {
  copyMusicCoverImageBestEffort,
  copyMusicCoverImageEffect,
  isApprovedMusicArtworkUrl
} from './music-cover-image.service'
import { S3Error } from '@/errors'
import type { S3Service } from './s3.service'

const makeS3 = () => ({
  uploadFile: vi.fn<Pick<S3Service, 'uploadFile'>['uploadFile']>((key) => Effect.succeed(key))
})

describe('music cover image archive', () => {
  test('accepts known provider and archive hosts over HTTPS', () => {
    expect(isApprovedMusicArtworkUrl('https://coverartarchive.org/release/id/front.jpg')).toBe(true)
    expect(isApprovedMusicArtworkUrl('https://archive.org/download/release/id.jpg')).toBe(true)
    expect(isApprovedMusicArtworkUrl('https://ia801.us.archive.org/cover.jpg')).toBe(true)
    expect(isApprovedMusicArtworkUrl('https://e-cdns-images.dzcdn.net/images/cover.jpg')).toBe(true)
    expect(isApprovedMusicArtworkUrl('http://coverartarchive.org/release/id/front.jpg')).toBe(false)
    expect(isApprovedMusicArtworkUrl('https://coverartarchive.org.example.com/cover.jpg')).toBe(
      false
    )
  })

  test('surfaces an upload failure instead of returning a url for an unwritten object', async () => {
    const s3 = {
      uploadFile: vi.fn<Pick<S3Service, 'uploadFile'>['uploadFile']>(() =>
        Effect.fail(new S3Error({ message: 'bucket unavailable', operation: 'uploadFile' }))
      )
    }
    const fetcher = vi.fn(() =>
      Promise.resolve(
        new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-type': 'image/jpeg' } })
      )
    )

    const exit = await Effect.runPromiseExit(
      copyMusicCoverImageEffect(
        s3,
        'https://cdn.gbfm.test',
        'user-content',
        'album',
        'album-id',
        'https://coverartarchive.org/release/id/front.jpg',
        fetcher
      )
    )

    expect(Exit.isFailure(exit)).toBe(true)
  })

  test('tolerates an upload failure on bulk import paths', async () => {
    const s3 = {
      uploadFile: vi.fn<Pick<S3Service, 'uploadFile'>['uploadFile']>(() =>
        Effect.fail(new S3Error({ message: 'bucket unavailable', operation: 'uploadFile' }))
      )
    }
    const fetcher = vi.fn(() =>
      Promise.resolve(
        new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-type': 'image/jpeg' } })
      )
    )

    const result = await Effect.runPromise(
      copyMusicCoverImageBestEffort(
        s3,
        'https://cdn.gbfm.test',
        'user-content',
        'playlist',
        'playlist-id',
        'https://coverartarchive.org/release/id/front.jpg',
        fetcher
      )
    )

    expect(result).toBeNull()
  })

  test('copies approved image responses into GBFM storage', async () => {
    const s3 = makeS3()
    const fetcher = vi.fn(() =>
      Promise.resolve(
        new Response(new Uint8Array([1, 2, 3]), {
          headers: { 'content-type': 'image/jpeg' }
        })
      )
    )

    const result = await Effect.runPromise(
      copyMusicCoverImageEffect(
        s3,
        'https://cdn.gbfm.test',
        'user-content',
        'album',
        'album-id',
        'https://coverartarchive.org/release/id/front.jpg',
        fetcher
      )
    )

    expect(result).toBe('https://cdn.gbfm.test/user-content/music/album/album-id/cover')
    expect(s3.uploadFile).toHaveBeenCalledWith(
      'music/album/album-id/cover',
      new Uint8Array([1, 2, 3]),
      'image/jpeg',
      'user-content'
    )
  })

  test('rejects unapproved hosts and non-image responses', async () => {
    const s3 = makeS3()
    const fetcher = vi.fn(() =>
      Promise.resolve(new Response('not an image', { headers: { 'content-type': 'text/html' } }))
    )

    const unapproved = await Effect.runPromise(
      copyMusicCoverImageEffect(
        s3,
        'https://cdn.gbfm.test',
        'user-content',
        'album',
        'album-id',
        'https://example.com/cover.jpg',
        fetcher
      )
    )
    const wrongType = await Effect.runPromise(
      copyMusicCoverImageEffect(
        s3,
        'https://cdn.gbfm.test',
        'user-content',
        'album',
        'album-id',
        'https://coverartarchive.org/release/id/front.jpg',
        fetcher
      )
    )

    expect(unapproved).toBeNull()
    expect(wrongType).toBeNull()
    expect(s3.uploadFile).not.toHaveBeenCalled()
  })

  test('rejects image responses larger than 10 MiB before upload', async () => {
    const s3 = makeS3()
    const fetcher = vi.fn(() =>
      Promise.resolve(
        new Response(new Uint8Array([1]), {
          headers: {
            'content-length': String(10 * 1024 * 1024 + 1),
            'content-type': 'image/jpeg'
          }
        })
      )
    )

    const result = await Effect.runPromise(
      copyMusicCoverImageEffect(
        s3,
        'https://cdn.gbfm.test',
        'user-content',
        'album',
        'album-id',
        'https://coverartarchive.org/release/id/front.jpg',
        fetcher
      )
    )

    expect(result).toBeNull()
    expect(s3.uploadFile).not.toHaveBeenCalled()
  })
})
