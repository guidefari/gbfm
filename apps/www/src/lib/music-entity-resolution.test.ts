import { QueryClient } from '@tanstack/react-query'
import { Effect } from 'effect'
import { describe, expect, test } from 'vitest'
import {
  canonicalMusicResolutionUrl,
  ensureEmbeddableMusicEntity,
  MusicEntityResolutionFailed,
  musicEntityResolutionQueryOptions,
  resolveMusicEntityWithCache,
  type ResolvedMusicEntity,
  type ResolveMusicEntityEffect
} from './music-entity-resolution'

const resolvedEntity: ResolvedMusicEntity = {
  entityType: 'track',
  entity: {
    id: 'track-1',
    title: 'Track one',
    slug: 'track-one',
    coverImageUrl: null
  },
  links: [],
  coverImageUrl: null
}

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false }
    }
  })

describe('music entity resolution cache', () => {
  test('reuses one cached result across authoring surfaces and equivalent URLs', async () => {
    const queryClient = createQueryClient()
    const requestedUrls: string[] = []
    const resolve: ResolveMusicEntityEffect = (url) =>
      Effect.sync(() => {
        requestedUrls.push(url)
        return resolvedEntity
      })
    const sharedUrl = 'https://open.spotify.com/track/4iV5W9uYEdYUVa79Axb7Rh'
    const sharedVariant = `${sharedUrl}?si=session&utm_source=editorial#player`

    const editorial = await resolveMusicEntityWithCache(
      queryClient,
      sharedVariant,
      'admin-1:admin',
      resolve
    )
    const tweet = await resolveMusicEntityWithCache(
      queryClient,
      sharedUrl,
      'admin-1:admin',
      resolve
    )
    const reply = await queryClient.fetchQuery(
      musicEntityResolutionQueryOptions(sharedUrl, 'admin-1:admin', resolve)
    )

    expect(editorial).toEqual(resolvedEntity)
    expect(tweet).toEqual(resolvedEntity)
    expect(reply).toEqual(resolvedEntity)
    expect(requestedUrls).toEqual([sharedVariant])
  })

  test('deduplicates in-flight resolution across authoring surfaces', async () => {
    const queryClient = createQueryClient()
    let requestCount = 0
    let complete: (() => void) | undefined
    const response = new Promise<ResolvedMusicEntity>((resolve) => {
      complete = () => resolve(resolvedEntity)
    })
    const resolve: ResolveMusicEntityEffect = () => {
      requestCount += 1
      return Effect.promise(() => response)
    }
    const url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'

    const editorial = resolveMusicEntityWithCache(queryClient, url, 'admin-1:admin', resolve)
    const tweet = resolveMusicEntityWithCache(
      queryClient,
      'https://youtu.be/dQw4w9WgXcQ',
      'admin-1:admin',
      resolve
    )
    const reply = queryClient.fetchQuery(
      musicEntityResolutionQueryOptions(url, 'admin-1:admin', resolve)
    )

    expect(requestCount).toBe(1)
    complete?.()
    await expect(Promise.all([editorial, tweet, reply])).resolves.toEqual([
      resolvedEntity,
      resolvedEntity,
      resolvedEntity
    ])
  })

  test('does not turn a failed resolution into a cached success', async () => {
    const queryClient = createQueryClient()
    let requestCount = 0
    const resolve: ResolveMusicEntityEffect = () => {
      requestCount += 1
      return requestCount === 1
        ? Effect.fail(new MusicEntityResolutionFailed({ message: 'Could not resolve music link' }))
        : Effect.succeed(resolvedEntity)
    }
    const url = 'https://open.spotify.com/track/4iV5W9uYEdYUVa79Axb7Rh'

    await expect(
      resolveMusicEntityWithCache(queryClient, url, 'admin-1:admin', resolve)
    ).rejects.toThrow()
    await expect(
      resolveMusicEntityWithCache(queryClient, url, 'admin-1:admin', resolve)
    ).resolves.toEqual(resolvedEntity)
    expect(requestCount).toBe(2)
  })

  test('rejects artist responses as unsupported post attachments', async () => {
    await expect(
      Effect.runPromise(
        ensureEmbeddableMusicEntity({
          entityType: 'artist',
          entity: {
            id: 'artist-1',
            name: 'Artist one',
            slug: 'artist-one',
            imageUrl: null
          },
          links: [],
          coverImageUrl: null
        })
      )
    ).rejects.toMatchObject({
      _tag: 'MusicEntityResolutionFailed',
      message: 'Artist links cannot be attached to posts'
    })
  })

  test('does not reuse authorized results across principals', async () => {
    const queryClient = createQueryClient()
    let requestCount = 0
    const resolve: ResolveMusicEntityEffect = () =>
      Effect.sync(() => {
        requestCount += 1
        return resolvedEntity
      })
    const url = 'https://open.spotify.com/track/4iV5W9uYEdYUVa79Axb7Rh'

    await resolveMusicEntityWithCache(queryClient, url, 'admin-1:admin', resolve)
    await resolveMusicEntityWithCache(queryClient, url, 'user-2:user', resolve)

    expect(requestCount).toBe(2)
  })

  test('normalizes generic source URLs without merging identity parameters', () => {
    expect(
      canonicalMusicResolutionUrl('https://example.com/release?b=2&utm_source=tweet&a=1#player')
    ).toBe('https://example.com/release?a=1&b=2')
    expect(canonicalMusicResolutionUrl('https://example.com/release?edition=deluxe')).not.toBe(
      canonicalMusicResolutionUrl('https://example.com/release?edition=standard')
    )
  })
})
