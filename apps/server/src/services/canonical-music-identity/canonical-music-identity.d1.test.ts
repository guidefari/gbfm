import { and, eq } from 'drizzle-orm'
import { Effect, Exit, Layer, Result } from 'effect'
import { beforeAll, describe, expect, test } from 'vitest'
import { Database } from '@/db/layer'
import {
  musicAlbumArtistsTable,
  musicAlbumsTable,
  musicArtistsTable,
  musicEntityLinksTable,
  musicEntityTypesTable,
  musicPlatformsTable,
  musicPlaylistsTable,
  musicSourceAliasesTable,
  musicSourceIdentitiesTable,
  musicSourceIdentityConflictsTable,
  musicTrackArtistsTable,
  musicTracksTable
} from '@/db/music-entity.schema'
import {
  MusicLinkScraperService,
  MusicScraperError,
  type MusicScrapeInput,
  type ScrapeResult
} from '@/services/music-link-scraper.service'
import { db } from '@/test/d1'
import { withTestLayer } from '@/test/effect'
import type { MusicIdentityError } from './errors'
import { parseMusicSource } from './music-source'
import { CanonicalMusicIdentityRepository } from './repository'
import {
  CanonicalMusicIdentity,
  CanonicalMusicIdentityLayer,
  CanonicalMusicIdentityLeaseTiming,
  type CanonicalMusicIdentityLeaseTimingConfig,
  type CanonicalMusicIdentityService,
  type ProviderMusicSnapshot
} from './index'

const externalId = () => crypto.randomUUID().replaceAll('-', '')

beforeAll(async () => {
  await db
    .insert(musicEntityTypesTable)
    .values([
      { id: 'artist', displayName: 'Artist' },
      { id: 'album', displayName: 'Album' },
      { id: 'track', displayName: 'Track' },
      { id: 'playlist', displayName: 'Playlist' }
    ])
    .onConflictDoNothing()
  await db
    .insert(musicPlatformsTable)
    .values([
      { id: 'spotify', displayName: 'Spotify' },
      { id: 'deezer', displayName: 'Deezer' },
      { id: 'youtube', displayName: 'YouTube' },
      { id: 'other', displayName: 'Other' }
    ])
    .onConflictDoNothing()
})

const serviceEffect = <A>(
  scraper: MusicLinkScraperService,
  use: (service: CanonicalMusicIdentityService) => Effect.Effect<A, MusicIdentityError>,
  leaseTiming?: CanonicalMusicIdentityLeaseTimingConfig
) => {
  const baseDependencies = Layer.merge(
    Layer.succeed(Database, db),
    Layer.succeed(MusicLinkScraperService, scraper)
  )
  const dependencies = leaseTiming
    ? Layer.merge(baseDependencies, Layer.succeed(CanonicalMusicIdentityLeaseTiming, leaseTiming))
    : baseDependencies
  const layer = CanonicalMusicIdentityLayer.pipe(Layer.provide(dependencies))
  return withTestLayer(Effect.flatMap(CanonicalMusicIdentity, use), layer)
}

const serviceWith = <A>(
  scraper: MusicLinkScraperService,
  use: (service: CanonicalMusicIdentityService) => Effect.Effect<A, MusicIdentityError>
) => Effect.runPromise(serviceEffect(scraper, use))

const serviceExitWith = <A>(
  scraper: MusicLinkScraperService,
  use: (service: CanonicalMusicIdentityService) => Effect.Effect<A, MusicIdentityError>
) => Effect.runPromiseExit(serviceEffect(scraper, use))

const recordingScraper = (
  scrape: (input: MusicScrapeInput) => Effect.Effect<ScrapeResult, never>
) => {
  const calls: MusicScrapeInput[] = []
  const service: MusicLinkScraperService = {
    scrape: (input) => {
      calls.push(input)
      return scrape(input)
    },
    discoverCrossPlatformLinks: () => Effect.succeed({ links: [] })
  }
  return { calls, service }
}

const snapshot = (
  sourceUrl: string,
  title = 'Imported Track',
  links?: ProviderMusicSnapshot['links']
): ProviderMusicSnapshot => ({
  entityType: 'track',
  sourceUrl,
  title,
  artistNames: ['Artist'],
  links
})

describe('CanonicalMusicIdentity', () => {
  test('returns indexed source and alias hits without provider calls', async () => {
    const id = externalId()
    const sourceUrl = `https://open.spotify.com/track/${id}?si=first`
    const recorder = recordingScraper(() => Effect.die('provider must not be called'))

    const result = await serviceWith(recorder.service, (service) =>
      Effect.gen(function* () {
        const imported = yield* service.importProviderEntity({
          snapshot: snapshot(sourceUrl),
          origin: 'spotify_import'
        })
        const canonical = yield* service.resolveSource({
          url: `https://open.spotify.com/track/${id}`,
          expectedType: 'track',
          origin: 'editorial'
        })
        const secondAlias = yield* service.resolveSource({
          url: `https://open.spotify.com/track/${id}?utm_source=share`,
          expectedType: 'track',
          origin: 'tweet'
        })
        return { imported, canonical, secondAlias }
      })
    )

    expect(recorder.calls).toHaveLength(0)
    expect(result.canonical.entity.id).toBe(result.imported.entity.id)
    expect(result.secondAlias.entity.id).toBe(result.imported.entity.id)
  })

  test('renews the D1 lease while provider work exceeds its initial duration', async () => {
    const id = externalId()
    const sourceUrl = `https://open.spotify.com/track/${id}`
    const title = `Heartbeat Track ${id}`
    const leaseTiming = { leaseMs: 90, waitAttempts: 100, waitMs: 5 }
    const gate = Promise.withResolvers<void>()
    const started = Promise.withResolvers<void>()
    const recorder = recordingScraper(() =>
      Effect.promise(async () => {
        started.resolve()
        await gate.promise
        return {
          links: [],
          entityMeta: { title, artistName: 'Artist', type: 'song' }
        }
      })
    )
    const resolve = serviceEffect(
      recorder.service,
      (service) =>
        service.resolveSource({ url: sourceUrl, expectedType: 'track', origin: 'editorial' }),
      leaseTiming
    )

    const first = Effect.runPromise(resolve)
    await started.promise
    const initialIdentity = await db
      .select()
      .from(musicSourceIdentitiesTable)
      .where(eq(musicSourceIdentitiesTable.sourceKey, `spotify:track:${id}`))
      .limit(1)
    const initialLeaseExpiresAt = initialIdentity[0]?.leaseExpiresAt?.getTime() ?? Date.now()
    await new Promise((resolveDelay) =>
      setTimeout(resolveDelay, Math.max(1, initialLeaseExpiresAt - Date.now() + 30))
    )
    const renewedIdentity = await db
      .select()
      .from(musicSourceIdentitiesTable)
      .where(eq(musicSourceIdentitiesTable.sourceKey, `spotify:track:${id}`))
      .limit(1)
    const second = Effect.runPromise(resolve)
    await new Promise((resolveDelay) => setTimeout(resolveDelay, leaseTiming.waitMs * 3))
    gate.resolve()
    const [firstResult, secondResult] = await Promise.all([first, second])
    const entities = await db
      .select()
      .from(musicTracksTable)
      .where(eq(musicTracksTable.title, title))

    expect(renewedIdentity[0]?.leaseExpiresAt?.getTime()).toBeGreaterThan(initialLeaseExpiresAt)
    expect(recorder.calls).toHaveLength(1)
    expect(entities).toHaveLength(1)
    expect(secondResult.entity.id).toBe(firstResult.entity.id)
  })

  test('fails resolution when its heartbeat detects lost claim ownership', async () => {
    const id = externalId()
    const sourceUrl = `https://open.spotify.com/track/${id}`
    const leaseTiming = { leaseMs: 90, waitAttempts: 100, waitMs: 5 }
    const gate = Promise.withResolvers<void>()
    const started = Promise.withResolvers<void>()
    const recorder = recordingScraper(() =>
      Effect.promise(async () => {
        started.resolve()
        await gate.promise
        return {
          links: [],
          entityMeta: { title: 'Lost Heartbeat', artistName: 'Artist', type: 'song' }
        }
      })
    )
    const resolution = Effect.runPromiseExit(
      serviceEffect(
        recorder.service,
        (service) =>
          service.resolveSource({ url: sourceUrl, expectedType: 'track', origin: 'editorial' }),
        leaseTiming
      )
    )

    await started.promise
    await db
      .update(musicSourceIdentitiesTable)
      .set({ ownerToken: crypto.randomUUID() })
      .where(eq(musicSourceIdentitiesTable.sourceKey, `spotify:track:${id}`))
    const exit = await resolution
    gate.resolve()
    const entities = await db
      .select()
      .from(musicTracksTable)
      .where(eq(musicTracksTable.title, 'Lost Heartbeat'))

    expect(Result.getOrThrow(Exit.findError(exit))).toMatchObject({
      _tag: 'MusicIdentityBusy',
      retryAfterMs: leaseTiming.leaseMs
    })
    expect(entities).toHaveLength(0)
  })

  test('returns a typed busy error for a live lease without scraping', async () => {
    const id = externalId()
    const sourceUrl = `https://open.spotify.com/track/${id}`
    await db.insert(musicSourceIdentitiesTable).values({
      sourceKey: `spotify:track:${id}`,
      platform: 'spotify',
      sourceEntityType: 'track',
      externalId: id,
      canonicalUrl: sourceUrl,
      state: 'resolving',
      ownerToken: crypto.randomUUID(),
      leaseExpiresAt: new Date(Date.now() + 60_000)
    })
    const recorder = recordingScraper(() => Effect.die('provider must not be called'))

    const exit = await serviceExitWith(recorder.service, (service) =>
      service.resolveSource({ url: sourceUrl, expectedType: 'track', origin: 'editorial' })
    )

    expect(Result.getOrThrow(Exit.findError(exit))).toMatchObject({
      _tag: 'MusicIdentityBusy'
    })
    expect(recorder.calls).toHaveLength(0)
  })

  test('prevents a lost lease owner from creating entity or link rows', async () => {
    const id = externalId()
    const sourceUrl = `https://open.spotify.com/track/${id}`
    const source = await Effect.runPromise(parseMusicSource(sourceUrl, 'track'))
    const repository = new CanonicalMusicIdentityRepository(db)
    const ownerToken = crypto.randomUUID()
    const replacementToken = crypto.randomUUID()
    const now = new Date()
    await Effect.runPromise(repository.claim(source, ownerToken, now, 30_000))
    await db
      .update(musicSourceIdentitiesTable)
      .set({ ownerToken: replacementToken })
      .where(eq(musicSourceIdentitiesTable.sourceKey, source.sourceKey))
    const entityId = crypto.randomUUID()

    const committed = await Effect.runPromise(
      repository.commit({
        ownedSources: [source],
        allSources: [source],
        reference: { entityType: 'track', entityId },
        entity: {
          entityType: 'track',
          entityId,
          title: 'Fenced Track',
          artistNames: [],
          artists: []
        },
        slug: entityId,
        links: [{ platform: 'spotify', url: sourceUrl, scrapedAt: now }],
        ownerToken,
        scrapedAt: now,
        now
      })
    )
    const entities = await db
      .select()
      .from(musicTracksTable)
      .where(eq(musicTracksTable.id, entityId))
    const links = await db
      .select()
      .from(musicEntityLinksTable)
      .where(eq(musicEntityLinksTable.entityId, entityId))

    expect(committed).toBe(false)
    expect(entities).toHaveLength(0)
    expect(links).toHaveLength(0)
  })

  test('reclaims an expired source lease', async () => {
    const id = externalId()
    const sourceUrl = `https://open.spotify.com/track/${id}`
    await db.insert(musicSourceIdentitiesTable).values({
      sourceKey: `spotify:track:${id}`,
      platform: 'spotify',
      sourceEntityType: 'track',
      externalId: id,
      canonicalUrl: sourceUrl,
      state: 'resolving',
      ownerToken: crypto.randomUUID(),
      leaseExpiresAt: new Date(Date.now() - 1)
    })
    const recorder = recordingScraper(() =>
      Effect.succeed({
        links: [],
        entityMeta: { title: 'Reclaimed Track', artistName: 'Artist', type: 'song' }
      })
    )

    const result = await serviceWith(recorder.service, (service) =>
      service.resolveSource({ url: sourceUrl, expectedType: 'track', origin: 'reply' })
    )
    const identities = await db
      .select()
      .from(musicSourceIdentitiesTable)
      .where(eq(musicSourceIdentitiesTable.sourceKey, `spotify:track:${id}`))

    expect(recorder.calls).toHaveLength(1)
    expect(identities[0]).toMatchObject({
      state: 'resolved',
      entityId: result.entity.id,
      ownerToken: null
    })
  })

  test('reuses an incumbent found through a discovered provider link', async () => {
    const spotifyId = externalId()
    const deezerId = String(Date.now())
    const spotifyUrl = `https://open.spotify.com/track/${spotifyId}`
    const deezerUrl = `https://www.deezer.com/track/${deezerId}`
    const recorder = recordingScraper(() =>
      Effect.succeed({
        links: [{ platform: 'spotify', url: spotifyUrl, scrapedAt: new Date() }],
        entityMeta: { title: 'Cross Platform', artistName: 'Artist', type: 'song' }
      })
    )

    const result = await serviceWith(recorder.service, (service) =>
      Effect.gen(function* () {
        const incumbent = yield* service.importProviderEntity({
          snapshot: snapshot(spotifyUrl),
          origin: 'spotify_import'
        })
        const discovered = yield* service.resolveSource({
          url: deezerUrl,
          expectedType: 'track',
          origin: 'bluesky'
        })
        return { incumbent, discovered }
      })
    )

    expect(recorder.calls).toHaveLength(1)
    expect(result.discovered.entity.id).toBe(result.incumbent.entity.id)
  })

  test('records conflicting discovered identities and does not merge them', async () => {
    const spotifyId = externalId()
    const deezerId = String(Date.now() + 1)
    const youtubeId = externalId()
    const spotifyUrl = `https://open.spotify.com/track/${spotifyId}`
    const deezerUrl = `https://www.deezer.com/track/${deezerId}`
    const youtubeUrl = `https://www.youtube.com/watch?v=${youtubeId}`
    const recorder = recordingScraper(() =>
      Effect.succeed({
        links: [
          { platform: 'spotify', url: spotifyUrl, scrapedAt: new Date() },
          { platform: 'deezer', url: deezerUrl, scrapedAt: new Date() }
        ],
        entityMeta: { title: 'Collision', artistName: 'Artist', type: 'song' }
      })
    )

    const exit = await serviceExitWith(recorder.service, (service) =>
      Effect.gen(function* () {
        yield* service.importProviderEntity({
          snapshot: snapshot(spotifyUrl, 'Spotify Entity'),
          origin: 'spotify_import'
        })
        yield* service.importProviderEntity({
          snapshot: snapshot(deezerUrl, 'Deezer Entity'),
          origin: 'playlist_enrichment'
        })
        return yield* service.resolveSource({
          url: youtubeUrl,
          expectedType: 'track',
          origin: 'tweet'
        })
      })
    )
    const conflicts = await db.select().from(musicSourceIdentityConflictsTable)
    const error = Result.getOrThrow(Exit.findError(exit))

    expect(error).toMatchObject({ _tag: 'MusicIdentityConflict' })
    expect(conflicts.some((conflict) => conflict.reason === 'discovered_sources_disagree')).toBe(
      true
    )
  })

  test('releases its source claim after provider failure', async () => {
    const id = externalId()
    const sourceUrl = `https://open.spotify.com/track/${id}`
    const scraper: MusicLinkScraperService = {
      scrape: () =>
        Effect.fail(
          new MusicScraperError({
            message: 'Unavailable',
            provider: 'spotify'
          })
        ),
      discoverCrossPlatformLinks: () => Effect.succeed({ links: [] })
    }

    const exit = await serviceExitWith(scraper, (service) =>
      service.resolveSource({ url: sourceUrl, expectedType: 'track', origin: 'editorial' })
    )
    const identities = await db
      .select()
      .from(musicSourceIdentitiesTable)
      .where(eq(musicSourceIdentitiesTable.sourceKey, `spotify:track:${id}`))

    expect(Result.getOrThrow(Exit.findError(exit))).toMatchObject({
      _tag: 'MusicIdentityProviderUnavailable'
    })
    expect(identities).toHaveLength(0)
  })

  test('rejects manual attachment when another entity owns the identity', async () => {
    const id = externalId()
    const sourceUrl = `https://open.spotify.com/track/${id}`
    const candidateId = crypto.randomUUID()
    await db.insert(musicTracksTable).values({
      id: candidateId,
      title: 'Candidate',
      slug: candidateId
    })
    const recorder = recordingScraper(() => Effect.die('provider must not be called'))

    const exit = await serviceExitWith(recorder.service, (service) =>
      Effect.gen(function* () {
        yield* service.importProviderEntity({
          snapshot: snapshot(sourceUrl),
          origin: 'spotify_import'
        })
        return yield* service.attachLink({
          entityType: 'track',
          entityId: candidateId,
          url: sourceUrl,
          origin: 'manual'
        })
      })
    )
    const candidateLinks = await db
      .select()
      .from(musicEntityLinksTable)
      .where(
        and(
          eq(musicEntityLinksTable.entityType, 'track'),
          eq(musicEntityLinksTable.entityId, candidateId)
        )
      )

    expect(Result.getOrThrow(Exit.findError(exit))).toMatchObject({
      _tag: 'MusicIdentityConflict'
    })
    expect(candidateLinks).toHaveLength(0)
  })

  test('imports trusted snapshots without calling a provider', async () => {
    const sourceUrl = `https://open.spotify.com/track/${externalId()}`
    const recorder = recordingScraper(() => Effect.die('provider must not be called'))

    const result = await serviceWith(recorder.service, (service) =>
      service.importProviderEntity({
        snapshot: snapshot(sourceUrl),
        origin: 'playlist_enrichment'
      })
    )

    expect(result.created).toBe(true)
    expect(result.entity.id).toBeTruthy()
    expect(recorder.calls).toHaveLength(0)
  })

  test('keeps existing data intact when refresh provider resolution fails', async () => {
    const id = externalId()
    const sourceUrl = `https://open.spotify.com/track/${id}`
    const scraper: MusicLinkScraperService = {
      scrape: () =>
        Effect.fail(
          new MusicScraperError({
            message: 'Refresh unavailable',
            provider: 'spotify'
          })
        ),
      discoverCrossPlatformLinks: () => Effect.succeed({ links: [] })
    }

    const exit = await serviceExitWith(scraper, (service) =>
      Effect.gen(function* () {
        const imported = yield* service.importProviderEntity({
          snapshot: snapshot(sourceUrl, 'Original Title'),
          origin: 'spotify_import'
        })
        return yield* service.refreshEntity({
          entityType: 'track',
          entityId: imported.entity.id,
          actorId: crypto.randomUUID()
        })
      })
    )
    const identities = await db
      .select()
      .from(musicSourceIdentitiesTable)
      .where(eq(musicSourceIdentitiesTable.sourceKey, `spotify:track:${id}`))
    const identity = identities[0]
    const entities = identity?.entityId
      ? await db.select().from(musicTracksTable).where(eq(musicTracksTable.id, identity.entityId))
      : []

    expect(Result.getOrThrow(Exit.findError(exit))).toMatchObject({
      _tag: 'MusicIdentityProviderUnavailable'
    })
    expect(entities[0]?.title).toBe('Original Title')
  })

  test('adopts canonical legacy link variants without scraping', async () => {
    const spotifyId = externalId()
    const youtubeId = externalId()
    const deezerId = String(Date.now() + 50)
    const variants = [
      {
        platform: 'spotify' as const,
        stored: `https://open.spotify.com/intl-en/track/${spotifyId}?si=legacy`,
        requested: `https://open.spotify.com/track/${spotifyId}`
      },
      {
        platform: 'youtube' as const,
        stored: `https://youtu.be/${youtubeId}?feature=shared`,
        requested: `https://www.youtube.com/watch?v=${youtubeId}`
      },
      {
        platform: 'deezer' as const,
        stored: `https://www.deezer.com/us/track/${deezerId}`,
        requested: `https://www.deezer.com/track/${deezerId}`
      }
    ]
    for (const variant of variants) {
      const entityId = crypto.randomUUID()
      await db.insert(musicTracksTable).values({
        id: entityId,
        title: `Legacy ${variant.platform}`,
        slug: entityId
      })
      await db.insert(musicEntityLinksTable).values({
        entityType: 'track',
        entityId,
        platform: variant.platform,
        url: variant.stored
      })
    }
    const recorder = recordingScraper(() => Effect.die('provider must not be called'))

    const results = await serviceWith(recorder.service, (service) =>
      Effect.forEach(variants, (variant) =>
        service.resolveSource({
          url: variant.requested,
          expectedType: 'track',
          origin: 'editorial'
        })
      )
    )

    expect(recorder.calls).toHaveLength(0)
    expect(results).toHaveLength(3)
    for (const variant of variants) {
      const parsed = await Effect.runPromise(parseMusicSource(variant.requested, 'track'))
      const identities = await db
        .select()
        .from(musicSourceIdentitiesTable)
        .where(eq(musicSourceIdentitiesTable.sourceKey, parsed.sourceKey))
      expect(identities[0]).toMatchObject({ state: 'resolved' })
    }
  })

  test('resolves crossing source claims by deterministic source-key priority', async () => {
    const spotifyUrl = `https://open.spotify.com/track/${externalId()}`
    const deezerUrl = `https://www.deezer.com/track/${String(Date.now() + 60)}`
    const bothStarted = Promise.withResolvers<void>()
    const gate = Promise.withResolvers<void>()
    let starts = 0
    const recorder = recordingScraper(() =>
      Effect.promise(async () => {
        starts += 1
        if (starts === 2) bothStarted.resolve()
        await gate.promise
        return {
          links: [
            { platform: 'spotify', url: spotifyUrl, scrapedAt: new Date() },
            { platform: 'deezer', url: deezerUrl, scrapedAt: new Date() }
          ],
          entityMeta: { title: 'Crossing Claims', artistName: 'Shared Artist', type: 'song' }
        }
      })
    )
    const spotify = serviceWith(recorder.service, (service) =>
      service.resolveSource({
        url: spotifyUrl,
        expectedType: 'track',
        origin: 'editorial'
      })
    )
    const deezer = serviceWith(recorder.service, (service) =>
      service.resolveSource({
        url: deezerUrl,
        expectedType: 'track',
        origin: 'tweet'
      })
    )
    await bothStarted.promise
    gate.resolve()

    const [spotifyResult, deezerResult] = await Promise.all([spotify, deezer])

    expect(recorder.calls).toHaveLength(2)
    expect(spotifyResult.entity.id).toBe(deezerResult.entity.id)
  })

  test('fences every write when a secondary source claim is lost', async () => {
    const spotifyUrl = `https://open.spotify.com/track/${externalId()}`
    const deezerUrl = `https://www.deezer.com/track/${String(Date.now() + 70)}`
    const spotifySource = await Effect.runPromise(parseMusicSource(spotifyUrl, 'track'))
    const deezerSource = await Effect.runPromise(parseMusicSource(deezerUrl, 'track'))
    const repository = new CanonicalMusicIdentityRepository(db)
    const ownerToken = crypto.randomUUID()
    const now = new Date()
    await Effect.runPromise(repository.claim(spotifySource, ownerToken, now, 30_000))
    await Effect.runPromise(repository.claim(deezerSource, ownerToken, now, 30_000))
    await db
      .update(musicSourceIdentitiesTable)
      .set({ ownerToken: crypto.randomUUID() })
      .where(eq(musicSourceIdentitiesTable.sourceKey, deezerSource.sourceKey))
    const entityId = crypto.randomUUID()

    const committed = await Effect.runPromise(
      repository.commit({
        ownedSources: [spotifySource, deezerSource],
        allSources: [spotifySource, deezerSource],
        reference: { entityType: 'track', entityId },
        entity: {
          entityType: 'track',
          entityId,
          title: 'Secondary Fence',
          artistNames: [],
          artists: []
        },
        slug: entityId,
        links: [{ platform: 'spotify', url: spotifyUrl, scrapedAt: now }],
        ownerToken,
        scrapedAt: now,
        now
      })
    )
    const entities = await db
      .select()
      .from(musicTracksTable)
      .where(eq(musicTracksTable.id, entityId))
    const links = await db
      .select()
      .from(musicEntityLinksTable)
      .where(eq(musicEntityLinksTable.entityId, entityId))
    const aliases = await db
      .select()
      .from(musicSourceAliasesTable)
      .where(eq(musicSourceAliasesTable.sourceKey, spotifySource.sourceKey))

    expect(committed).toBe(false)
    expect(entities).toHaveLength(0)
    expect(links).toHaveLength(0)
    expect(aliases).toHaveLength(0)
  })

  test('preserves artist reuse, relation order, denormalized names, and public slugs', async () => {
    const albumUrl = `https://open.spotify.com/album/${externalId()}`
    const trackUrl = `https://open.spotify.com/track/${externalId()}`
    const recorder = recordingScraper(() => Effect.die('provider must not be called'))

    const result = await serviceWith(recorder.service, (service) =>
      Effect.gen(function* () {
        const album = yield* service.importProviderEntity({
          snapshot: {
            entityType: 'album',
            sourceUrl: albumUrl,
            title: 'Shared Title',
            artistNames: ['First Artist', 'Second Artist']
          },
          origin: 'spotify_import'
        })
        const track = yield* service.importProviderEntity({
          snapshot: {
            entityType: 'track',
            sourceUrl: trackUrl,
            title: 'Shared Title',
            artistNames: ['first artist', 'Second Artist']
          },
          origin: 'playlist_enrichment'
        })
        return { album, track }
      })
    )
    const artists = await db.select().from(musicArtistsTable)
    const albumRelations = await db
      .select()
      .from(musicAlbumArtistsTable)
      .where(eq(musicAlbumArtistsTable.albumId, result.album.entity.id))
      .orderBy(musicAlbumArtistsTable.displayOrder)
    const trackRelations = await db
      .select()
      .from(musicTrackArtistsTable)
      .where(eq(musicTrackArtistsTable.trackId, result.track.entity.id))
      .orderBy(musicTrackArtistsTable.displayOrder)
    const albums = await db
      .select()
      .from(musicAlbumsTable)
      .where(eq(musicAlbumsTable.id, result.album.entity.id))
    const tracks = await db
      .select()
      .from(musicTracksTable)
      .where(eq(musicTracksTable.id, result.track.entity.id))

    const relatedArtistIds = new Set(
      [...albumRelations, ...trackRelations].map((row) => row.artistId)
    )
    expect([...relatedArtistIds]).toHaveLength(2)
    expect(artists.filter((artist) => relatedArtistIds.has(artist.id))).toHaveLength(2)
    expect(albumRelations.map((row) => row.displayOrder)).toEqual([0, 1])
    expect(trackRelations.map((row) => row.displayOrder)).toEqual([0, 1])
    expect(albums[0]?.artistNames).toEqual(['First Artist', 'Second Artist'])
    expect(tracks[0]?.artistNames).toEqual(['First Artist', 'Second Artist'])
    expect(albums[0]?.slug).toMatch(/^shared-title-[a-f0-9]{8}$/)
    expect(tracks[0]?.slug).toMatch(/^shared-title-[a-f0-9]{8}$/)
  })

  test('preserves snapshot playlist and Spotify import fields', async () => {
    const playlistUrl = `https://open.spotify.com/playlist/${externalId()}`
    const trackUrl = `https://open.spotify.com/track/${externalId()}`
    const recorder = recordingScraper(() => Effect.die('provider must not be called'))

    const result = await serviceWith(recorder.service, (service) =>
      Effect.gen(function* () {
        const playlist = yield* service.importProviderEntity({
          snapshot: {
            entityType: 'playlist',
            sourceUrl: playlistUrl,
            title: 'Imported Playlist',
            description: 'Playlist description',
            sourceMetadata: { spotifyPlaylistId: 'playlist-id' }
          },
          origin: 'spotify_import'
        })
        const track = yield* service.importProviderEntity({
          snapshot: {
            entityType: 'track',
            sourceUrl: trackUrl,
            title: 'Imported Track Fields',
            artistNames: ['Artist'],
            trackNumber: 7,
            sourceMetadata: {
              spotifyTrackId: 'track-id',
              durationMs: 1234,
              previewUrl: 'https://example.com/preview.mp3',
              albumName: 'Album',
              albumSpotifyId: 'album-id'
            }
          },
          origin: 'playlist_enrichment'
        })
        return { playlist, track }
      })
    )

    expect(
      'description' in result.playlist.entity ? result.playlist.entity.description : null
    ).toBe('Playlist description')
    expect('trackNumber' in result.track.entity ? result.track.entity.trackNumber : null).toBe(7)
    expect(result.playlist.links[0]?.metadata).toMatchObject({ spotifyPlaylistId: 'playlist-id' })
    expect(result.track.links[0]?.metadata).toMatchObject({
      spotifyTrackId: 'track-id',
      durationMs: 1234,
      albumSpotifyId: 'album-id'
    })
  })

  test('stores the parsed source as canonical exact_source despite provider metadata', async () => {
    const id = externalId()
    const requested = `https://open.spotify.com/intl-en/track/${id}?si=request`
    const recorder = recordingScraper(() =>
      Effect.succeed({
        links: [
          {
            platform: 'spotify',
            url: `https://open.spotify.com/track/${id}?utm_source=provider`,
            scrapedAt: new Date()
          }
        ],
        entityMeta: { title: 'Canonical Source', artistName: 'Artist', type: 'song' }
      })
    )

    const result = await serviceWith(recorder.service, (service) =>
      service.resolveSource({ url: requested, expectedType: 'track', origin: 'editorial' })
    )
    const source = result.links.find((link) => link.platform === 'spotify')

    expect(source?.url).toBe(`https://open.spotify.com/track/${id}`)
    expect(source?.metadata).toMatchObject({ confidence: 'exact_source' })
  })

  test('playlist refresh replaces stale links with the exact source only', async () => {
    const sourceUrl = `https://open.spotify.com/playlist/${externalId()}`
    const recorder = recordingScraper(() =>
      Effect.succeed({
        links: [
          { platform: 'spotify', url: `${sourceUrl}?si=refresh`, scrapedAt: new Date() },
          {
            platform: 'youtube',
            url: `https://www.youtube.com/playlist?list=${externalId()}`,
            scrapedAt: new Date()
          }
        ],
        entityMeta: { title: 'Refreshed Playlist', type: 'playlist' }
      })
    )

    const result = await serviceWith(recorder.service, (service) =>
      Effect.gen(function* () {
        const imported = yield* service.importProviderEntity({
          snapshot: {
            entityType: 'playlist',
            sourceUrl,
            title: 'Playlist',
            links: [
              { platform: 'youtube', url: `https://www.youtube.com/playlist?list=${externalId()}` }
            ]
          },
          origin: 'spotify_import'
        })
        return yield* service.refreshEntity({
          entityType: 'playlist',
          entityId: imported.entity.id,
          actorId: crypto.randomUUID()
        })
      })
    )

    expect(result.links).toHaveLength(1)
    expect(result.links[0]).toMatchObject({ platform: 'spotify', url: sourceUrl })
  })

  test('returns a typed collision for an alias mapped to another parsed source key', async () => {
    const requestedUrl = `https://open.spotify.com/track/${externalId()}`
    const incumbentUrl = `https://open.spotify.com/track/${externalId()}`
    const requested = await Effect.runPromise(parseMusicSource(requestedUrl, 'track'))
    const incumbent = await Effect.runPromise(parseMusicSource(incumbentUrl, 'track'))
    const entityId = crypto.randomUUID()
    const now = new Date()
    await db.insert(musicTracksTable).values({ id: entityId, title: 'Alias Owner', slug: entityId })
    await db.insert(musicSourceIdentitiesTable).values({
      sourceKey: incumbent.sourceKey,
      platform: incumbent.platform,
      sourceEntityType: incumbent.sourceEntityType,
      externalId: incumbent.externalId,
      canonicalUrl: incumbent.canonicalUrl,
      state: 'resolved',
      entityType: 'track',
      entityId,
      resolvedAt: now
    })
    await db.insert(musicSourceAliasesTable).values({
      normalizedUrl: requested.normalizedUrl,
      sourceKey: incumbent.sourceKey,
      firstSeenAt: now,
      lastSeenAt: now
    })
    const recorder = recordingScraper(() => Effect.die('provider must not be called'))

    const exit = await serviceExitWith(recorder.service, (service) =>
      service.resolveSource({ url: requestedUrl, expectedType: 'track', origin: 'editorial' })
    )
    const aliases = await db
      .select()
      .from(musicSourceAliasesTable)
      .where(eq(musicSourceAliasesTable.normalizedUrl, requested.normalizedUrl))

    expect(Result.getOrThrow(Exit.findError(exit))).toMatchObject({
      _tag: 'MusicIdentityAliasCollision',
      expectedSourceKey: requested.sourceKey,
      storedSourceKey: incumbent.sourceKey
    })
    expect(aliases[0]?.sourceKey).toBe(incumbent.sourceKey)
    expect(recorder.calls).toHaveLength(0)
  })

  test('preserves provider rejection versus outage classification', async () => {
    const cases = [
      { statusCode: 400, tag: 'MusicIdentityProviderRejected', reason: 'invalid_request' },
      { statusCode: 404, tag: 'MusicIdentityProviderRejected', reason: 'not_found' },
      { statusCode: 503, tag: 'MusicIdentityProviderUnavailable', reason: undefined }
    ] as const

    for (const item of cases) {
      const scraper: MusicLinkScraperService = {
        scrape: () =>
          Effect.fail(
            new MusicScraperError({
              message: 'Provider response',
              provider: 'spotify',
              statusCode: item.statusCode
            })
          ),
        discoverCrossPlatformLinks: () => Effect.succeed({ links: [] })
      }
      const exit = await serviceExitWith(scraper, (service) =>
        service.resolveSource({
          url: `https://open.spotify.com/track/${externalId()}`,
          expectedType: 'track',
          origin: 'editorial'
        })
      )
      const error = Result.getOrThrow(Exit.findError(exit))
      expect(error._tag).toBe(item.tag)
      expect('reason' in error ? error.reason : undefined).toBe(item.reason)
    }
  })

  test('delete during attach cannot create a link, alias, or completed identity', async () => {
    const id = externalId()
    const sourceUrl = `https://open.spotify.com/track/${id}`
    const source = await Effect.runPromise(parseMusicSource(sourceUrl, 'track'))
    const entityId = crypto.randomUUID()
    await db
      .insert(musicTracksTable)
      .values({ id: entityId, title: 'Attach Target', slug: entityId })
    await db.insert(musicSourceIdentitiesTable).values({
      sourceKey: source.sourceKey,
      platform: source.platform,
      sourceEntityType: source.sourceEntityType,
      externalId: source.externalId,
      canonicalUrl: source.canonicalUrl,
      state: 'resolving',
      ownerToken: crypto.randomUUID(),
      leaseExpiresAt: new Date(Date.now() + 60_000)
    })
    const recorder = recordingScraper(() => Effect.die('provider must not be called'))
    const attaching = serviceExitWith(recorder.service, (service) =>
      service.attachLink({ entityType: 'track', entityId, url: sourceUrl, origin: 'manual' })
    )
    await new Promise((resolve) => setTimeout(resolve, 50))
    await db.batch([
      db.delete(musicTracksTable).where(eq(musicTracksTable.id, entityId)),
      db
        .delete(musicSourceIdentitiesTable)
        .where(eq(musicSourceIdentitiesTable.sourceKey, source.sourceKey))
    ])
    const exit = await attaching
    const links = await db
      .select()
      .from(musicEntityLinksTable)
      .where(eq(musicEntityLinksTable.entityId, entityId))
    const aliases = await db
      .select()
      .from(musicSourceAliasesTable)
      .where(eq(musicSourceAliasesTable.normalizedUrl, source.normalizedUrl))
    const identities = await db
      .select()
      .from(musicSourceIdentitiesTable)
      .where(eq(musicSourceIdentitiesTable.sourceKey, source.sourceKey))

    expect(Result.getOrThrow(Exit.findError(exit))).toMatchObject({
      _tag: 'MusicIdentityEntityNotFound'
    })
    expect(links).toHaveLength(0)
    expect(aliases).toHaveLength(0)
    expect(identities.every((identity) => identity.state !== 'resolved')).toBe(true)
  })

  test('delete during refresh cannot recreate links or update a missing target', async () => {
    const sourceUrl = `https://open.spotify.com/track/${externalId()}`
    const started = Promise.withResolvers<void>()
    const gate = Promise.withResolvers<void>()
    const recorder = recordingScraper(() =>
      Effect.promise(async () => {
        started.resolve()
        await gate.promise
        return {
          links: [
            {
              platform: 'deezer',
              url: `https://www.deezer.com/track/${String(Date.now() + 80)}`,
              scrapedAt: new Date()
            }
          ],
          entityMeta: { title: 'Deleted Refresh', artistName: 'Artist', type: 'song' }
        }
      })
    )
    const imported = await serviceWith(recorder.service, (service) =>
      service.importProviderEntity({
        snapshot: snapshot(sourceUrl, 'Delete During Refresh'),
        origin: 'spotify_import'
      })
    )
    const refresh = serviceExitWith(recorder.service, (service) =>
      service.refreshEntity({
        entityType: 'track',
        entityId: imported.entity.id,
        actorId: crypto.randomUUID()
      })
    )
    await started.promise
    await db.delete(musicTracksTable).where(eq(musicTracksTable.id, imported.entity.id))
    gate.resolve()
    const exit = await refresh
    const newLinks = await db
      .select()
      .from(musicEntityLinksTable)
      .where(
        and(
          eq(musicEntityLinksTable.entityId, imported.entity.id),
          eq(musicEntityLinksTable.platform, 'deezer')
        )
      )

    expect(Result.getOrThrow(Exit.findError(exit))).toMatchObject({
      _tag: 'MusicIdentityEntityNotFound'
    })
    expect(newLinks).toHaveLength(0)
  })

  test('explicit refresh always calls the provider and preserves the entity ID', async () => {
    const sourceUrl = `https://open.spotify.com/track/${externalId()}`
    const recorder = recordingScraper(() =>
      Effect.succeed({
        links: [],
        entityMeta: { title: 'Refreshed Title', artistName: 'Artist', type: 'song' }
      })
    )

    const result = await serviceWith(recorder.service, (service) =>
      Effect.gen(function* () {
        const imported = yield* service.importProviderEntity({
          snapshot: snapshot(sourceUrl, 'Original Title', [
            {
              platform: 'spotify',
              url: sourceUrl,
              metadata: { discoveredBy: 'spotify', confidence: 'exact_source' }
            }
          ]),
          origin: 'spotify_import'
        })
        const first = yield* service.refreshEntity({
          entityType: 'track',
          entityId: imported.entity.id,
          actorId: crypto.randomUUID()
        })
        const second = yield* service.refreshEntity({
          entityType: 'track',
          entityId: imported.entity.id,
          actorId: crypto.randomUUID()
        })
        return { imported, first, second }
      })
    )

    expect(recorder.calls).toHaveLength(2)
    expect(result.first.entity.id).toBe(result.imported.entity.id)
    expect(result.second.entity.id).toBe(result.imported.entity.id)
    expect('title' in result.second.entity ? result.second.entity.title : '').toBe(
      'Refreshed Title'
    )
  })
})
