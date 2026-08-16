import { LINK_STATUS } from '@gbfm/core/status'
import { and, eq, isNull, lt } from 'drizzle-orm'
import { Data, Effect, Schedule } from 'effect'
import { Database } from '@/db/layer'
import {
  type MusicEntityType,
  type MusicPlatform,
  musicEntityResolutionClaimsTable,
  musicEntityLinksTable,
  type SelectMusicAlbum,
  type SelectMusicArtist,
  type SelectMusicEntityLink,
  type SelectMusicPlaylist,
  type SelectMusicTrack
} from '@/db/music-entity.schema'
import { DatabaseError, getErrorMessage, NotFoundError, ValidationError } from '@/errors'
import type {
  MusicLinkScraperService,
  MusicScrapeInput,
  MusicScrapeOptions
} from '@/services/music-link-scraper.service'
import { parseArtistNames } from '@/services/parse-artist-names'
import { toSlug } from '@/services/to-slug'
import { createAlbumEffect, getAlbumByIdEffect } from './album.service'
import {
  findOrCreateArtist,
  findOrCreateArtistsByName,
  getArtistByIdEffect
} from './artist.service'
import { addLinkEffect, getLinksForEntityEffect } from './link.service'
import { createPlaylistEffect, getPlaylistByIdEffect } from './playlist.service'
import { createTrackEffect, getTrackByIdEffect } from './track.service'

type ScrapeableMusicEntityType = Exclude<MusicEntityType, 'label'>
type CanonicalSourceLink = { readonly platform: MusicPlatform; readonly url: string }
type ResolvedMusicEntity =
  | SelectMusicArtist
  | SelectMusicAlbum
  | SelectMusicTrack
  | SelectMusicPlaylist

class MusicEntityResolutionPending extends Data.TaggedError('MusicEntityResolutionPending') {}

export class MusicEntityResolutionUnavailable extends Data.TaggedError(
  'MusicEntityResolutionUnavailable'
)<{ readonly retryAfterMs: number }> {}

const CLAIM_LEASE_MS = 30_000
const CLAIM_WAIT_ATTEMPTS = 20
const CLAIM_WAIT_INTERVAL = '50 millis'

const SCRAPEABLE_MUSIC_ENTITY_TYPES: readonly ScrapeableMusicEntityType[] = [
  'artist',
  'album',
  'track',
  'playlist'
]

function isScrapeableMusicEntityType(value: string): value is ScrapeableMusicEntityType {
  return SCRAPEABLE_MUSIC_ENTITY_TYPES.some((type) => type === value)
}

const findExistingEntityByUrl = (url: string, entityType: ScrapeableMusicEntityType) =>
  Effect.gen(function* () {
    const db = yield* Database
    const exact = yield* Effect.tryPromise({
      try: () =>
        db
          .select()
          .from(musicEntityLinksTable)
          .where(
            and(
              eq(musicEntityLinksTable.url, url),
              eq(musicEntityLinksTable.entityType, entityType)
            )
          )
          .limit(1),
      catch: (e) =>
        new DatabaseError({
          message: `Failed to check existing link: ${getErrorMessage(e)}`,
          operation: 'select',
          table: 'music_entity_links'
        })
    })
    if (exact.length > 0) return exact

    const source = canonicalSourceLink(url)
    if (source.platform !== 'spotify' && source.platform !== 'youtube') return exact

    return yield* Effect.tryPromise({
      try: async () => {
        const links = await db
          .select()
          .from(musicEntityLinksTable)
          .where(eq(musicEntityLinksTable.entityType, entityType))
        return links.filter((link) => canonicalSourceLink(link.url).url === source.url).slice(0, 1)
      },
      catch: (e) =>
        new DatabaseError({
          message: `Failed to check legacy link: ${getErrorMessage(e)}`,
          operation: 'select',
          table: 'music_entity_links'
        })
    })
  }).pipe(Effect.withSpan('musicEntity.findExistingEntityByUrl'))

const getClaimedEntity = (entityType: ScrapeableMusicEntityType, canonicalUrl: string) =>
  Effect.gen(function* () {
    const db = yield* Database
    const claims = yield* Effect.tryPromise({
      try: () =>
        db
          .select()
          .from(musicEntityResolutionClaimsTable)
          .where(
            and(
              eq(musicEntityResolutionClaimsTable.entityType, entityType),
              eq(musicEntityResolutionClaimsTable.canonicalUrl, canonicalUrl)
            )
          )
          .limit(1),
      catch: (e) =>
        new DatabaseError({
          message: `Failed to get music resolution claim: ${getErrorMessage(e)}`,
          operation: 'select',
          table: 'music_entity_resolution_claims'
        })
    })
    const claim = claims[0]
    if (!claim?.entityId) return yield* new MusicEntityResolutionPending()

    const entity = yield* Effect.catchTag(
      getEntityById(entityType, claim.entityId),
      'NotFoundError',
      () => Effect.succeed(null)
    )
    if (!entity) {
      yield* deleteCompletedResolutionClaim(entityType, canonicalUrl, claim.entityId)
      return yield* new MusicEntityResolutionPending()
    }

    const links = yield* getLinksForEntityEffect(entityType, entity.id)
    return { entity, links } satisfies {
      entity: ResolvedMusicEntity
      links: SelectMusicEntityLink[]
    }
  })

const claimResolution = (entityType: ScrapeableMusicEntityType, canonicalUrl: string) =>
  Effect.gen(function* () {
    const db = yield* Database
    const ownerToken = crypto.randomUUID()
    const leaseExpiresAt = new Date(Date.now() + CLAIM_LEASE_MS)
    const inserted = yield* Effect.tryPromise({
      try: () =>
        db
          .insert(musicEntityResolutionClaimsTable)
          .values({ entityType, canonicalUrl, ownerToken, leaseExpiresAt })
          .onConflictDoNothing()
          .returning(),
      catch: (e) =>
        new DatabaseError({
          message: `Failed to claim music resolution: ${getErrorMessage(e)}`,
          operation: 'insert',
          table: 'music_entity_resolution_claims'
        })
    })
    if (inserted[0]) return { ownerToken } as const

    const reclaimed = yield* Effect.tryPromise({
      try: () =>
        db
          .update(musicEntityResolutionClaimsTable)
          .set({ ownerToken, leaseExpiresAt, updatedAt: new Date() })
          .where(
            and(
              eq(musicEntityResolutionClaimsTable.entityType, entityType),
              eq(musicEntityResolutionClaimsTable.canonicalUrl, canonicalUrl),
              isNull(musicEntityResolutionClaimsTable.entityId),
              lt(musicEntityResolutionClaimsTable.leaseExpiresAt, new Date())
            )
          )
          .returning(),
      catch: (e) =>
        new DatabaseError({
          message: `Failed to reclaim music resolution claim: ${getErrorMessage(e)}`,
          operation: 'update',
          table: 'music_entity_resolution_claims'
        })
    })
    if (reclaimed[0]) return { ownerToken } as const
    return yield* getClaimedEntity(entityType, canonicalUrl)
  }).pipe(
    Effect.retry({
      schedule: Schedule.spaced(CLAIM_WAIT_INTERVAL).pipe(
        Schedule.upTo({ times: CLAIM_WAIT_ATTEMPTS })
      ),
      while: (error) => error._tag === 'MusicEntityResolutionPending'
    }),
    Effect.catchTag(
      'MusicEntityResolutionPending',
      () => new MusicEntityResolutionUnavailable({ retryAfterMs: CLAIM_LEASE_MS })
    )
  )

const completeResolutionClaim = (
  entityType: ScrapeableMusicEntityType,
  canonicalUrl: string,
  entityId: string,
  ownerToken: string
) =>
  Effect.gen(function* () {
    const db = yield* Database
    yield* Effect.tryPromise({
      try: () =>
        db
          .update(musicEntityResolutionClaimsTable)
          .set({ entityId, ownerToken: null, leaseExpiresAt: null, updatedAt: new Date() })
          .where(
            and(
              eq(musicEntityResolutionClaimsTable.entityType, entityType),
              eq(musicEntityResolutionClaimsTable.canonicalUrl, canonicalUrl),
              isNull(musicEntityResolutionClaimsTable.entityId),
              eq(musicEntityResolutionClaimsTable.ownerToken, ownerToken)
            )
          ),
      catch: (e) =>
        new DatabaseError({
          message: `Failed to complete music resolution claim: ${getErrorMessage(e)}`,
          operation: 'update',
          table: 'music_entity_resolution_claims'
        })
    })
  })

const renewResolutionClaim = (
  entityType: ScrapeableMusicEntityType,
  canonicalUrl: string,
  ownerToken: string
) =>
  Effect.gen(function* () {
    const db = yield* Database
    const rows = yield* Effect.tryPromise({
      try: () =>
        db
          .update(musicEntityResolutionClaimsTable)
          .set({ leaseExpiresAt: new Date(Date.now() + CLAIM_LEASE_MS), updatedAt: new Date() })
          .where(
            and(
              eq(musicEntityResolutionClaimsTable.entityType, entityType),
              eq(musicEntityResolutionClaimsTable.canonicalUrl, canonicalUrl),
              isNull(musicEntityResolutionClaimsTable.entityId),
              eq(musicEntityResolutionClaimsTable.ownerToken, ownerToken)
            )
          )
          .returning({ ownerToken: musicEntityResolutionClaimsTable.ownerToken }),
      catch: (e) =>
        new DatabaseError({
          message: `Failed to renew music resolution claim: ${getErrorMessage(e)}`,
          operation: 'update',
          table: 'music_entity_resolution_claims'
        })
    })
    if (!rows[0]) {
      return yield* new MusicEntityResolutionUnavailable({ retryAfterMs: CLAIM_LEASE_MS })
    }

    return undefined
  })

const deleteUnresolvedResolutionClaim = (
  entityType: ScrapeableMusicEntityType,
  canonicalUrl: string,
  ownerToken: string
) =>
  Effect.gen(function* () {
    const db = yield* Database
    yield* Effect.tryPromise({
      try: () =>
        db
          .delete(musicEntityResolutionClaimsTable)
          .where(
            and(
              eq(musicEntityResolutionClaimsTable.entityType, entityType),
              eq(musicEntityResolutionClaimsTable.canonicalUrl, canonicalUrl),
              isNull(musicEntityResolutionClaimsTable.entityId),
              eq(musicEntityResolutionClaimsTable.ownerToken, ownerToken)
            )
          ),
      catch: (e) =>
        new DatabaseError({
          message: `Failed to release music resolution claim: ${getErrorMessage(e)}`,
          operation: 'delete',
          table: 'music_entity_resolution_claims'
        })
    })
  })

const deleteCompletedResolutionClaim = (
  entityType: ScrapeableMusicEntityType,
  canonicalUrl: string,
  entityId: string
) =>
  Effect.gen(function* () {
    const db = yield* Database
    yield* Effect.tryPromise({
      try: () =>
        db
          .delete(musicEntityResolutionClaimsTable)
          .where(
            and(
              eq(musicEntityResolutionClaimsTable.entityType, entityType),
              eq(musicEntityResolutionClaimsTable.canonicalUrl, canonicalUrl),
              eq(musicEntityResolutionClaimsTable.entityId, entityId)
            )
          ),
      catch: (e) =>
        new DatabaseError({
          message: `Failed to delete stale music resolution claim: ${getErrorMessage(e)}`,
          operation: 'delete',
          table: 'music_entity_resolution_claims'
        })
    })
  })

const getEntityById = (
  entityType: ScrapeableMusicEntityType,
  entityId: string
): Effect.Effect<
  SelectMusicArtist | SelectMusicAlbum | SelectMusicTrack | SelectMusicPlaylist,
  DatabaseError | NotFoundError,
  Database
> => {
  switch (entityType) {
    case 'artist':
      return getArtistByIdEffect(entityId)
    case 'album':
      return getAlbumByIdEffect(entityId)
    case 'track':
      return getTrackByIdEffect(entityId)
    case 'playlist':
      return getPlaylistByIdEffect(entityId)
    default:
      return Effect.die(`Unsupported music entity type: ${entityType}`)
  }
}

export const scrapeAndCreateEntityEffect = (
  scraper: MusicLinkScraperService,
  entityType: ScrapeableMusicEntityType,
  input: MusicScrapeInput
) => {
  let resolutionOwnerToken: string | undefined

  return Effect.gen(function* () {
    const source = input.url ? canonicalSourceLink(input.url) : undefined

    if (source) {
      const existingLinks = yield* findExistingEntityByUrl(source.url, entityType)
      const match = existingLinks[0]
      if (match && isScrapeableMusicEntityType(match.entityType)) {
        const entity = yield* Effect.catchTag(
          getEntityById(match.entityType, match.entityId),
          'NotFoundError',
          () => Effect.succeed(null)
        )
        if (entity) {
          const links = yield* getLinksForEntityEffect(match.entityType, match.entityId)
          yield* Effect.logInfo(
            `[MusicEntity] URL already scraped, returning existing ${match.entityType}:${match.entityId}`
          )
          return { entity, links }
        }
      }

      const resolution = yield* claimResolution(entityType, source.url)
      if ('ownerToken' in resolution) {
        resolutionOwnerToken = resolution.ownerToken
      } else {
        return resolution
      }
    }

    const result = yield* scraper.scrape({ ...input, entityType })
    const meta = result.entityMeta

    if (!hasUsableScrapeResult(result)) {
      return yield* new ValidationError({
        message: 'Music URL resolution returned no metadata or links',
        field: 'url'
      })
    }
    if (source && resolutionOwnerToken) {
      yield* renewResolutionClaim(entityType, source.url, resolutionOwnerToken)
    }

    const rawArtistName = meta?.artistName ?? input.artistName
    const foundArtists =
      rawArtistName && (entityType === 'album' || entityType === 'track')
        ? yield* findOrCreateArtistsByName(parseArtistNames(rawArtistName))
        : undefined
    const artistNames = foundArtists?.map((a) => a.name)
    const artistIds = foundArtists?.map((a) => a.id)

    const entity = yield* (() => {
      switch (entityType) {
        case 'artist': {
          const name = meta?.artistName ?? input.artistName ?? 'Unknown Artist'
          return findOrCreateArtist(name, {
            imageUrl: meta?.thumbnailUrl
          })
        }
        case 'album': {
          const title = meta?.title ?? input.albumTitle ?? 'Untitled Album'
          return createAlbumEffect({
            title,
            slug: toSlug(title),
            artistNames,
            artistIds,
            coverImageUrl: meta?.thumbnailUrl
          })
        }
        case 'track': {
          const title = meta?.title ?? input.trackTitle ?? 'Untitled Track'
          return createTrackEffect({
            title,
            slug: toSlug(title),
            artistNames,
            artistIds,
            coverImageUrl: meta?.thumbnailUrl
          })
        }
        case 'playlist': {
          const title = meta?.title ?? 'Untitled Playlist'
          return createPlaylistEffect({
            title,
            slug: toSlug(title),
            coverImageUrl: meta?.thumbnailUrl
          })
        }
        default:
          return Effect.die(`Unsupported music entity type: ${entityType}`)
      }
    })()

    const entityId = entity.id
    const inserted: SelectMusicEntityLink[] = []
    if (source) {
      const sourceLink = yield* addLinkEffect({
        entityType,
        entityId,
        platform: source.platform,
        url: source.url,
        status: LINK_STATUS.VERIFIED
      })
      inserted.push(sourceLink)
    }
    for (const link of result.links) {
      if (link.platform === source?.platform) continue
      const row = yield* Effect.catch(
        addLinkEffect({
          entityType,
          entityId,
          platform: link.platform,
          url: link.url,
          status: LINK_STATUS.VERIFIED,
          verifiedAt: link.scrapedAt,
          scrapedAt: link.scrapedAt,
          metadata: link.metadata
        }),
        (e) =>
          Effect.andThen(
            Effect.logWarning(`Failed to persist scraped link ${link.platform}: ${e.message}`),
            Effect.succeed<SelectMusicEntityLink | null>(null)
          )
      )
      if (row) inserted.push(row)
    }

    yield* Effect.logInfo(
      `[MusicEntity] Scraped ${inserted.length} links for ${entityType}:${entityId}`
    )
    if (source) {
      if (!resolutionOwnerToken) {
        return yield* new DatabaseError({
          message: 'Music resolution claim owner token is missing',
          operation: 'update',
          table: 'music_entity_resolution_claims'
        })
      }
      yield* completeResolutionClaim(entityType, source.url, entityId, resolutionOwnerToken)
    }

    return { entity, links: inserted }
  }).pipe(
    Effect.tapError(() =>
      resolutionOwnerToken && input.url
        ? deleteUnresolvedResolutionClaim(
            entityType,
            canonicalSourceLink(input.url).url,
            resolutionOwnerToken
          )
        : Effect.void
    ),
    Effect.withSpan('musicEntity.scrapeAndCreateEntity', {
      attributes: { entityType }
    })
  )
}

export const refreshEntityLinksEffect = (
  scraper: MusicLinkScraperService,
  entityType: ScrapeableMusicEntityType,
  entityId: string,
  options?: MusicScrapeOptions
): Effect.Effect<{ links: SelectMusicEntityLink[] }, DatabaseError | NotFoundError, Database> =>
  Effect.gen(function* () {
    yield* getEntityById(entityType, entityId)
    const existingLinks = yield* getLinksForEntityEffect(entityType, entityId)
    const sourceLink = selectSourceLink(existingLinks)

    if (!sourceLink) {
      return yield* new NotFoundError({
        message: 'Music entity source link not found',
        resource: 'MusicEntitySourceLink',
        id: entityId
      })
    }

    const result = yield* scraper.scrape({ entityType, url: sourceLink.url }, options)
    const refreshedLinks =
      entityType === 'playlist'
        ? result.links.filter((link) => link.platform === sourceLink.platform)
        : result.links
    const links = yield* Effect.forEach(refreshedLinks, (link) =>
      addLinkEffect({
        entityType,
        entityId,
        platform: link.platform,
        url: link.url,
        status: LINK_STATUS.VERIFIED,
        verifiedAt: link.scrapedAt,
        scrapedAt: link.scrapedAt,
        metadata: link.metadata
      })
    )

    return { links }
  }).pipe(
    Effect.withSpan('musicEntity.refreshEntityLinks', {
      attributes: { entityType, entityId }
    })
  )

function selectSourceLink(
  links: readonly SelectMusicEntityLink[]
): SelectMusicEntityLink | undefined {
  return (
    links.find((link) => link.metadata?.confidence === 'exact_source') ??
    links.find((link) => link.platform === 'spotify') ??
    links.find((link) => link.platform === 'deezer') ??
    links[0]
  )
}

const hasUsableScrapeResult = (result: {
  readonly links: readonly unknown[]
  readonly entityMeta?: {
    readonly title?: string
    readonly artistName?: string
    readonly thumbnailUrl?: string
    readonly isrc?: string
  }
}): boolean =>
  result.links.length > 0 ||
  Boolean(
    result.entityMeta?.title ||
    result.entityMeta?.artistName ||
    result.entityMeta?.thumbnailUrl ||
    result.entityMeta?.isrc
  )

function canonicalSourceLink(url: string): CanonicalSourceLink {
  try {
    const parsed = new URL(url)
    const hostname = parsed.hostname.toLowerCase()
    const segments = parsed.pathname.split('/').filter(Boolean)
    if ((hostname === 'spotify.com' || hostname.endsWith('.spotify.com')) && segments.length >= 2) {
      const [type, id] = segments
      if ((type === 'track' || type === 'album' || type === 'playlist') && id) {
        return { platform: 'spotify', url: `https://open.spotify.com/${type}/${id}` }
      }
    }
    if (hostname === 'youtube.com' || hostname === 'www.youtube.com' || hostname === 'youtu.be') {
      const id =
        hostname === 'youtu.be'
          ? segments[0]
          : (parsed.searchParams.get('v') ?? (segments[0] === 'embed' ? segments[1] : undefined))
      if (id) return { platform: 'youtube', url: `https://www.youtube.com/watch?v=${id}` }
    }

    parsed.hash = ''
    return { platform: platformForHostname(hostname), url: parsed.toString() }
  } catch {
    return { platform: 'other', url }
  }
}

function platformForHostname(hostname: string): MusicPlatform {
  if (hostname.endsWith('bandcamp.com')) return 'bandcamp'
  if (hostname.endsWith('soundcloud.com')) return 'soundcloud'
  if (hostname.endsWith('music.apple.com')) return 'apple_music'
  if (hostname.endsWith('youtube.com') || hostname === 'youtu.be') return 'youtube'
  if (hostname.endsWith('tidal.com')) return 'tidal'
  if (hostname.endsWith('deezer.com')) return 'deezer'
  if (hostname.endsWith('amazon.com')) return 'amazon_music'
  return 'other'
}
