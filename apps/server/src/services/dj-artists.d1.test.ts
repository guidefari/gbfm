import { eq } from 'drizzle-orm'
import { Effect, Layer, Result } from 'effect'
import { expect, test } from 'vitest'

import { audioArtists, audioCreators, audioTable } from '@/db/audio.schema'
import { user } from '@/db/auth.schema'
import { DatabaseLayer, makeDatabaseClient } from '@/db/layer'
import { musicArtistsTable } from '@/db/music-entity.schema'
import { MdxServiceLayer } from '@/lib/mdx'
import { withTestLayer } from '@/test/effect'
import { createMigratedD1Database } from '@/test/migrate-d1'

import { AudioService, AudioServiceLayer } from './audio.service'
import { ConfigServiceLayer } from './config.service'
import { getHomepageMixes } from './featured-mix'
import { ProfileService, ProfileServiceLayer } from './profile.service'
import { ResolveService, ResolveServiceLayer } from './resolve.service'
import { UnavailableObjectStoreClientLayer } from './storage/object-store-client'
import { UploadAssetServiceLayer } from './upload-asset.service'
import { UserService, UserServiceLayer } from './user.service'

test('DJ artist identities preserve ownership and expose only published mix contributions', async () => {
  await using resource = await createMigratedD1Database()
  const db = makeDatabaseClient(resource.database)
  const artistId = '00000000-0000-4000-8000-000000000001'
  const draftArtistId = '00000000-0000-4000-8000-000000000002'
  await db.insert(user).values([
    { id: 'host', name: 'Host', username: 'host', email: 'host@example.test', banned: false },
    { id: 'other', name: 'Other', username: 'other', email: 'other@example.test', banned: false },
  ])
  await db.insert(musicArtistsTable).values([
    {
      id: artistId,
      name: 'The Ensemble',
      slug: 'the-ensemble',
      bio: 'A DJ alias, intended to grow into a group.',
      publishedAt: new Date('2026-01-01'),
    },
    { id: draftArtistId, name: 'Private artist', slug: 'private-artist' },
    {
      id: 'catalogue-only',
      name: 'Recording artist',
      slug: 'recording-artist',
      publishedAt: new Date('2026-01-01'),
    },
  ])

  const servicesLayer = Layer.mergeAll(
    AudioServiceLayer,
    UserServiceLayer,
    ProfileServiceLayer,
    ResolveServiceLayer,
  ).pipe(
    Layer.provide(MdxServiceLayer),
    Layer.provide(UnavailableObjectStoreClientLayer),
    Layer.provide(Layer.mergeAll(ConfigServiceLayer, UploadAssetServiceLayer)),
    Layer.provide(DatabaseLayer(resource.database)),
  )

  const services = await Effect.runPromise(
    withTestLayer(
      Effect.gen(function* () {
        return {
          audio: yield* AudioService,
          user: yield* UserService,
          profile: yield* ProfileService,
          resolve: yield* ResolveService,
        }
      }),
      servicesLayer,
    ),
  )

  const create = (slug: string, draft: boolean, artistIds: ReadonlyArray<string> = []) =>
    Effect.runPromise(
      services.audio.create(
        {
          title: slug,
          slug,
          draft,
          content: '',
          type: 'mix',
          url: 'https://example.test/mix.mp3',
          artistIds,
        },
        ['host'],
        { actorId: 'host', idempotencyKey: crypto.randomUUID() },
      ),
    )

  const aliasDraft = await create('alias-draft', true, [artistId])
  const privateDraft = await create('private-draft', true, [draftArtistId])
  const hostMix = await create('host-mix', false)

  expect(aliasDraft.artists).toEqual([
    { id: artistId, name: 'The Ensemble', username: 'the-ensemble' },
  ])
  expect(
    await db.select().from(audioCreators).where(eq(audioCreators.audioId, aliasDraft.id)),
  ).toEqual([{ audioId: aliasDraft.id, creatorId: 'host' }])
  expect(await Effect.runPromise(services.user.listDjs())).toMatchObject([
    { id: 'host', mixCount: 1 },
    { id: artistId, name: 'The Ensemble', mixCount: 0 },
  ])

  const draftOnlyProfile = await Effect.runPromise(
    services.profile.getPublicProfile('the-ensemble'),
  )

  expect(draftOnlyProfile.content.mixes).toEqual([])
  expect(draftOnlyProfile.bio).toContain('grow into a group')
  const resolved = await Effect.runPromise(services.resolve.resolve('the-ensemble'))
  expect(resolved).toMatchObject({ type: 'profile', data: { id: artistId } })

  const hidden = await Effect.runPromise(
    Effect.result(services.profile.getPublicProfile('private-artist')),
  )

  expect(Result.isFailure(hidden) && hidden.failure._tag).toBe('NotFoundError')

  const anonymous = await Effect.runPromise(
    Effect.result(services.audio.getBySlug('mix', aliasDraft.slug)),
  )

  expect(Result.isFailure(anonymous) && anonymous.failure._tag).toBe('NotFoundError')

  const denied = await Effect.runPromise(
    Effect.result(
      services.audio.update('mix', aliasDraft.slug, 'other', 'creator', { artistIds: [] }),
    ),
  )

  expect(Result.isFailure(denied) && denied.failure._tag).toBe('UnauthorizedError')

  const invalid = await Effect.runPromise(
    Effect.result(
      services.audio.update('mix', aliasDraft.slug, 'host', 'creator', {
        title: 'Must not change',
        artistIds: ['missing'],
      }),
    ),
  )

  expect(Result.isFailure(invalid) && invalid.failure._tag).toBe('ValidationError')

  const unchanged = await Effect.runPromise(
    services.audio.getBySlugForEdit('mix', aliasDraft.slug, 'host', 'creator'),
  )

  expect(unchanged.title).toBe('alias-draft')
  expect(unchanged.creators?.map(({ id }) => id)).toEqual(['host'])
  expect(unchanged.artists?.map(({ id }) => id)).toEqual([artistId])

  const published = await create('alias-public', false, [artistId])
  const publicProfile = await Effect.runPromise(services.profile.getPublicProfile('the-ensemble'))
  expect(publicProfile.content.mixes.map(({ id }) => id)).toEqual([published.id])
  const hostProfile = await Effect.runPromise(services.profile.getPublicProfile('host'))
  expect(hostProfile.content.mixes.map(({ id }) => id)).toEqual([hostMix.id])

  const publicList = await Effect.runPromise(
    services.audio.getByType('mix', { limit: 100, offset: 0 }),
  )

  expect(
    publicList.data.find(({ id }) => id === published.id)?.artists?.map(({ id }) => id),
  ).toEqual([artistId])
  expect(publicList.data.map(({ id }) => id)).not.toContain(aliasDraft.id)
  expect(publicList.data.map(({ id }) => id)).not.toContain(privateDraft.id)
  const directory = await Effect.runPromise(services.user.listDjs())
  expect(directory.map(({ id }) => id)).toEqual(['host', artistId])
  expect(directory.find(({ id }) => id === artistId)?.mixCount).toBe(1)

  const homepage = await Effect.runPromise(
    withTestLayer(getHomepageMixes(), DatabaseLayer(resource.database)),
  )

  expect(homepage.data[0]?.artists?.map(({ id }) => id)).toEqual([artistId])

  await Effect.runPromise(
    services.audio.update('mix', aliasDraft.slug, 'host', 'creator', {
      artistIds: [artistId, artistId],
    }),
  )
  expect(
    await db.select().from(audioArtists).where(eq(audioArtists.audioId, aliasDraft.id)),
  ).toHaveLength(1)

  const collaboration = await Effect.runPromise(
    services.audio.update('mix', aliasDraft.slug, 'host', 'creator', {
      artistIds: [draftArtistId, artistId],
    }),
  )

  expect(collaboration.artists?.map(({ id }) => id)).toEqual([draftArtistId, artistId])

  const cleared = await Effect.runPromise(
    services.audio.update('mix', aliasDraft.slug, 'host', 'creator', { artistIds: [] }),
  )

  expect(cleared.artists).toEqual([])
  expect(cleared.creators?.map(({ id }) => id)).toEqual(['host'])
  expect(cleared.draft).toBe(true)
  expect(await db.select().from(audioTable).where(eq(audioTable.id, hostMix.id))).toHaveLength(1)
})
