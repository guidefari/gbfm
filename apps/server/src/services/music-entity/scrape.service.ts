import { LINK_STATUS } from '@gbfm/core/status'
import { and, eq } from 'drizzle-orm'
import { Effect } from 'effect'
import { Database } from '@/db/layer'
import {
  type MusicEntityType,
  type MusicPlatform,
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
  MusicScrapeOptions,
  MusicScraperError
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
    return yield* Effect.tryPromise({
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
  }).pipe(Effect.withSpan('musicEntity.findExistingEntityByUrl'))

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
  }
}

export const scrapeAndCreateEntityEffect = (
  scraper: MusicLinkScraperService,
  entityType: ScrapeableMusicEntityType,
  input: MusicScrapeInput
) =>
  Effect.gen(function* () {
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
    }

    const result = yield* scraper.scrape(input)
    const meta = result.entityMeta

    if (!hasUsableScrapeResult(result)) {
      return yield* new ValidationError({
        message: 'Music URL resolution returned no metadata or links',
        field: 'url'
      })
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

    return { entity, links: inserted }
  }).pipe(
    Effect.withSpan('musicEntity.scrapeAndCreateEntity', {
      attributes: { entityType }
    })
  )

export const rescrapeOdesliLinksEffect = (
  scraper: MusicLinkScraperService,
  entityType: ScrapeableMusicEntityType,
  entityId: string,
  options?: MusicScrapeOptions
): Effect.Effect<
  { links: SelectMusicEntityLink[] },
  DatabaseError | NotFoundError | MusicScraperError,
  Database
> =>
  Effect.gen(function* () {
    yield* getEntityById(entityType, entityId)
    const existingLinks = yield* getLinksForEntityEffect(entityType, entityId)
    const spotifyLink = existingLinks.find((link) => link.platform === 'spotify')

    if (!spotifyLink) {
      return yield* new NotFoundError({
        message: 'Spotify source link not found',
        resource: 'MusicEntitySpotifyLink',
        id: entityId
      })
    }

    const result = yield* scraper.scrapeOdesli({ url: spotifyLink.url }, options)
    const links = yield* Effect.forEach(result.links, (link) =>
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
    Effect.withSpan('musicEntity.rescrapeOdesliLinks', {
      attributes: { entityType, entityId }
    })
  )

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
    if (hostname.endsWith('spotify.com') && segments.length >= 2) {
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
