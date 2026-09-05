import { LINK_STATUS } from '@gbfm/core/status'
import { Effect } from 'effect'
import { Database } from '@/db/layer'
import type {
  MusicEntityType,
  SelectMusicAlbum,
  SelectMusicArtist,
  SelectMusicEntityLink,
  SelectMusicPlaylist,
  SelectMusicTrack
} from '@/db/music-entity.schema'
import { ValidationError } from '@/errors'
import type {
  MusicLinkScraperService,
  MusicScraperError
} from '@/services/music-link-scraper.service'
import { parseArtistNames } from '@/services/parse-artist-names'
import { toSlug } from '@/services/to-slug'
import { createAlbumEffect } from './album.service'
import { findOrCreateArtist, findOrCreateArtistsByName } from './artist.service'
import { addLinkEffect } from './link.service'
import { createPlaylistEffect } from './playlist.service'
import { createTrackEffect } from './track.service'

type ScrapeableMusicEntityType = Exclude<MusicEntityType, 'label'>

const unreachableEntityType = (entityType: never): never => {
  throw new Error(`Unexpected scrapeable music entity type: ${String(entityType)}`)
}

export type MusicMetadataScrapeInput = {
  readonly artistName?: string
  readonly albumTitle?: string
  readonly trackTitle?: string
  readonly mbid?: string
  readonly isrc?: string
}

export type ScrapedMusicEntity = {
  readonly entity: SelectMusicArtist | SelectMusicAlbum | SelectMusicTrack | SelectMusicPlaylist
  readonly links: readonly SelectMusicEntityLink[]
}

export const scrapeAndCreateEntityWithoutSourceEffect = (
  scraper: MusicLinkScraperService,
  entityType: ScrapeableMusicEntityType,
  input: MusicMetadataScrapeInput
) =>
  Effect.gen(function* () {
    const result = yield* scraper.scrape({ ...input, entityType })
    const meta = result.entityMeta

    if (!hasUsableScrapeResult(result)) {
      return yield* new ValidationError({
        message: 'Music metadata resolution returned no metadata or links',
        field: 'url'
      })
    }

    const rawArtistName = meta?.artistName ?? input.artistName
    const foundArtists =
      rawArtistName && (entityType === 'album' || entityType === 'track')
        ? yield* findOrCreateArtistsByName(parseArtistNames(rawArtistName))
        : undefined
    const artistNames = foundArtists?.map((artist) => artist.name)
    const artistIds = foundArtists?.map((artist) => artist.id)

    const entity = yield* (() => {
      switch (entityType) {
        case 'artist': {
          const name = meta?.artistName ?? input.artistName ?? 'Unknown Artist'
          return findOrCreateArtist(name, { imageUrl: meta?.thumbnailUrl })
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
          return unreachableEntityType(entityType)
      }
    })()

    const inserted: SelectMusicEntityLink[] = []
    for (const link of result.links) {
      const row = yield* Effect.catch(
        addLinkEffect({
          entityType,
          entityId: entity.id,
          platform: link.platform,
          url: link.url,
          status: LINK_STATUS.VERIFIED,
          verifiedAt: link.scrapedAt,
          scrapedAt: link.scrapedAt,
          metadata: link.metadata
        }),
        (error) =>
          Effect.andThen(
            Effect.logWarning(`Failed to persist scraped link ${link.platform}: ${error.message}`),
            Effect.succeed<SelectMusicEntityLink | null>(null)
          )
      )
      if (row) inserted.push(row)
    }

    yield* Effect.logInfo(
      `[MusicEntity] Scraped ${inserted.length} links for ${entityType}:${entity.id}`
    )
    return { entity, links: inserted } satisfies ScrapedMusicEntity
  }).pipe(
    Effect.withSpan('musicEntity.scrapeAndCreateEntityWithoutSource', {
      attributes: { entityType }
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

export type ScrapeWithoutSourceError = MusicScraperError | ValidationError
