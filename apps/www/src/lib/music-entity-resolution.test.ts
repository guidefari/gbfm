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
    const requests: Array<{ url: string; origin: string }> = []
    const resolve: ResolveMusicEntityEffect = (url, origin) =>
      Effect.sync(() => {
        requests.push({ url, origin })
        return resolvedEntity
      })
    const sharedUrl = 'https://open.spotify.com/track/4iV5W9uYEdYUVa79Axb7Rh'
    const sharedVariant = `${sharedUrl}?si=session&utm_source=editorial#player`

    const editorial = await resolveMusicEntityWithCache(
      queryClient,
      sharedVariant,
      'admin-1:admin',
      'editorial',
      resolve
    )
    const tweet = await resolveMusicEntityWithCache(
      queryClient,
      sharedUrl,
      'admin-1:admin',
      'tweet',
      resolve
    )
    const reply = await queryClient.fetchQuery(
      musicEntityResolutionQueryOptions(sharedUrl, 'admin-1:admin', 'reply', resolve)
    )

    expect(editorial).toEqual(resolvedEntity)
    expect(tweet).toEqual(resolvedEntity)
    expect(reply).toEqual(resolvedEntity)
    expect(requests).toEqual([{ url: sharedVariant, origin: 'editorial' }])
  })

  test('deduplicates in-flight resolution across authoring surfaces', async () => {
    const queryClient = createQueryClient()
    let requestCount = 0
    let complete: (() => void) | undefined
    const response = new Promise<ResolvedMusicEntity>((resolve) => {
      complete = () => resolve(resolvedEntity)
    })
    const requestedOrigins: string[] = []
    const resolve: ResolveMusicEntityEffect = (_url, origin) => {
      requestCount += 1
      requestedOrigins.push(origin)
      return Effect.promise(() => response)
    }
    const url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'

    const editorial = resolveMusicEntityWithCache(
      queryClient,
      url,
      'admin-1:admin',
      'editorial',
      resolve
    )
    const tweet = resolveMusicEntityWithCache(
      queryClient,
      'https://youtu.be/dQw4w9WgXcQ',
      'admin-1:admin',
      'tweet',
      resolve
    )
    const reply = queryClient.fetchQuery(
      musicEntityResolutionQueryOptions(url, 'admin-1:admin', 'reply', resolve)
    )

    expect(requestCount).toBe(1)
    expect(requestedOrigins).toEqual(['editorial'])
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
      resolveMusicEntityWithCache(queryClient, url, 'admin-1:admin', 'tweet', resolve)
    ).rejects.toThrow()
    await expect(
      resolveMusicEntityWithCache(queryClient, url, 'admin-1:admin', 'tweet', resolve)
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

    await resolveMusicEntityWithCache(queryClient, url, 'admin-1:admin', 'tweet', resolve)
    await resolveMusicEntityWithCache(queryClient, url, 'user-2:user', 'reply', resolve)

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
