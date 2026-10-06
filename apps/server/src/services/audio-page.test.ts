import { AudioPageResponse, type AudioPagePrincipal } from '@gbfm/api/audio'
import { Cause, Effect, Exit, Layer } from 'effect'
import { beforeAll, describe, expect, test } from 'vitest'

import { audioTable } from '@/db/audio.schema'
import { user } from '@/db/auth.schema'
import { favoritesTable } from '@/db/favorites.schema'
import { DatabaseError } from '@/errors'
import { MdxServiceLayer } from '@/lib/mdx'
import { DatabaseTestLayer, db } from '@/test/database'
import { withTestLayer } from '@/test/effect'

import { loadAudioPage } from './audio-page'
import { AudioService, AudioServiceLayer } from './audio.service'
import { ConfigService, ConfigServiceLayer } from './config.service'
import { FavoriteService, FavoriteServiceLayer } from './favorite.service'
import { UploadAssetServiceLayer } from './upload-asset.service'

const principal: AudioPagePrincipal = {
  id: 'audio-page-service-listener',
  name: 'Fixture listener',
  username: null,
  image: null,
  role: 'user',
}

const slug = 'audio-page-service-public'

const services = Layer.mergeAll(
  AudioServiceLayer.pipe(
    Layer.provide(MdxServiceLayer),
    Layer.provide(Layer.mergeAll(ConfigServiceLayer, UploadAssetServiceLayer)),
    Layer.provide(DatabaseTestLayer),
  ),
  FavoriteServiceLayer.pipe(Layer.provide(DatabaseTestLayer)),
  ConfigServiceLayer,
)

const failure = () =>
  new DatabaseError({
    message: 'Fixture dependency unavailable',
    operation: 'select',
    table: 'audio',
  })

beforeAll(async () => {
  await db
    .insert(user)
    .values({ id: principal.id, name: 'Fixture listener', email: 'audio-page-service@example.com' })
  await db.insert(audioTable).values({
    id: slug,
    slug,
    title: 'Service fixture',
    content: 'Fixture content',
    type: 'mix',
    url: 'https://example.com/audio.mp3',
  })
})

describe('Audio page failure boundaries and read ownership', () => {
  test('audio database failure returns unavailable while retaining the trusted identity', async () => {
    const page = await Effect.runPromise(
      withTestLayer(
        Effect.gen(function* () {
          const audio = yield* AudioService

          return yield* loadAudioPage('mix', slug, principal).pipe(
            Effect.provideService(AudioService, {
              ...audio,
              getBySlug: () => Effect.fail(failure()),
            }),
          )
        }),
        services,
      ),
    )

    expect(page).toEqual(AudioPageResponse.cases.Unavailable.make({ principal }))
  })

  test('favorite failure does not prevent rendering available audio', async () => {
    const page = await Effect.runPromise(
      withTestLayer(
        Effect.gen(function* () {
          const favorites = yield* FavoriteService

          return yield* loadAudioPage('mix', slug, principal).pipe(
            Effect.provideService(FavoriteService, {
              ...favorites,
              hasAudioFavorite: () => Effect.fail(failure()),
            }),
          )
        }),
        services,
      ),
    )

    if (!AudioPageResponse.guards.Ready(page)) throw new Error('Expected ready page')
    expect(page.favorite).toBe('unavailable')
    expect(page.audio.slug).toBe(slug)
    expect(page.principal).toEqual(principal)
  })

  test('metadata failure does not prevent rendering available audio', async () => {
    const page = await Effect.runPromise(
      withTestLayer(
        Effect.gen(function* () {
          const config = yield* ConfigService

          return yield* loadAudioPage('mix', slug, principal).pipe(
            Effect.provideService(ConfigService, {
              ...config,
              urls: {
                ...config.urls,
                get frontend(): string {
                  throw new Error('Fixture metadata configuration unavailable')
                },
              },
            }),
          )
        }),
        services,
      ),
    )

    if (!AudioPageResponse.guards.Ready(page)) throw new Error('Expected ready page')
    expect(page.audio.slug).toBe(slug)
    expect(page.metadata).toBeNull()
  })

  test('metadata is derived without another audio service read and anonymous pages skip membership', async () => {
    const reads: Array<{ type: string; slug: string }> = []
    const memberships: Array<string> = []

    const page = await Effect.runPromise(
      withTestLayer(
        Effect.gen(function* () {
          const audio = yield* AudioService
          const favorites = yield* FavoriteService

          return yield* loadAudioPage('mix', slug, null).pipe(
            Effect.provideService(AudioService, {
              ...audio,
              getBySlug: (type, slug, actor) => {
                reads.push({ type, slug })

                return audio.getBySlug(type, slug, actor)
              },
            }),
            Effect.provideService(FavoriteService, {
              ...favorites,
              hasAudioFavorite: (userId, audioId) => {
                memberships.push(audioId)

                return favorites.hasAudioFavorite(userId, audioId)
              },
            }),
          )
        }),
        services,
      ),
    )

    expect(AudioPageResponse.guards.Ready(page)).toBe(true)
    expect(reads).toEqual([{ type: 'mix', slug }])
    expect(memberships).toEqual([])
  })

  test('interruption is not converted into an unavailable page', async () => {
    const result = await Effect.runPromiseExit(
      withTestLayer(
        Effect.gen(function* () {
          const audio = yield* AudioService

          return yield* loadAudioPage('mix', slug, principal).pipe(
            Effect.provideService(AudioService, { ...audio, getBySlug: () => Effect.interrupt }),
          )
        }),
        services,
      ),
    )

    expect(Exit.isFailure(result)).toBe(true)

    if (!Exit.isFailure(result)) throw new Error('Expected interrupted page read')
    expect(Cause.hasInterrupts(result.cause)).toBe(true)
  })

  test('favorite interruption is not converted into unavailable action state', async () => {
    const result = await Effect.runPromiseExit(
      withTestLayer(
        Effect.gen(function* () {
          const favorites = yield* FavoriteService

          return yield* loadAudioPage('mix', slug, principal).pipe(
            Effect.provideService(FavoriteService, {
              ...favorites,
              hasAudioFavorite: () => Effect.interrupt,
            }),
          )
        }),
        services,
      ),
    )

    if (!Exit.isFailure(result)) throw new Error('Expected interrupted favorite read')
    expect(Cause.hasInterrupts(result.cause)).toBe(true)
  })

  test('unavailable audio does not start favorite membership reads', async () => {
    const memberships: Array<string> = []

    const page = await Effect.runPromise(
      withTestLayer(
        Effect.gen(function* () {
          const favorites = yield* FavoriteService

          return yield* loadAudioPage('mix', 'audio-page-missing', principal).pipe(
            Effect.provideService(FavoriteService, {
              ...favorites,
              hasAudioFavorite: (userId, audioId) => {
                memberships.push(audioId)

                return favorites.hasAudioFavorite(userId, audioId)
              },
            }),
          )
        }),
        services,
      ),
    )

    expect(page).toEqual(AudioPageResponse.cases.NotFound.make({ principal }))
    expect(memberships).toEqual([])
  })

  test('membership reads the target even when it lies beyond the first collection page', async () => {
    const audio = Array.from({ length: 105 }, (_, index) => ({
      id: `membership-${index}`,
      slug: `membership-${index}`,
      title: 'Membership fixture',
      content: '',
      type: 'mix' as const,
      url: 'https://example.com/audio.mp3',
    }))

    for (let offset = 0; offset < audio.length; offset += 5) {
      const chunk = audio.slice(offset, offset + 5)
      await db.insert(audioTable).values(chunk)
      await db
        .insert(favoritesTable)
        .values(chunk.map((item) => ({ userId: principal.id, audioId: item.id })))
    }

    const result = await Effect.runPromise(
      withTestLayer(
        Effect.gen(function* () {
          const favorites = yield* FavoriteService

          return {
            found: yield* favorites.hasAudioFavorite(principal.id, 'membership-104'),
            absent: yield* favorites.hasAudioFavorite(principal.id, slug),
            otherUser: yield* favorites.hasAudioFavorite('other-listener', 'membership-104'),
          }
        }),
        services,
      ),
    )

    expect(result).toEqual({ found: true, absent: false, otherUser: false })
  })
})
