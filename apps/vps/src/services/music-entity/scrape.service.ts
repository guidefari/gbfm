import { and, eq } from 'drizzle-orm'
import { Effect } from 'effect'
import type { db as DbType } from '@/db'
import {
  type MusicEntityType,
  musicEntityLinksTable,
  type SelectMusicAlbum,
  type SelectMusicArtist,
  type SelectMusicEntityLink,
  type SelectMusicPlaylist,
  type SelectMusicTrack
} from '@/db/music-entity.schema'
import { DatabaseError, getErrorMessage, type NotFoundError } from '@/errors'
import type {
  MusicLinkScraperService,
  MusicScrapeInput
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

const findExistingEntityByUrl =
  (db: typeof DbType) => (url: string, entityType: MusicEntityType) =>
    Effect.gen(function* () {
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

const getEntityById =
  (db: typeof DbType) =>
  (
    entityType: MusicEntityType,
    entityId: string
  ): Effect.Effect<
    | SelectMusicArtist
    | SelectMusicAlbum
    | SelectMusicTrack
    | SelectMusicPlaylist,
    DatabaseError | NotFoundError
  > => {
    switch (entityType) {
      case 'artist':
        return getArtistByIdEffect(db)(entityId)
      case 'album':
        return getAlbumByIdEffect(db)(entityId)
      case 'track':
        return getTrackByIdEffect(db)(entityId)
      case 'playlist':
        return getPlaylistByIdEffect(db)(entityId)
    }
  }

export const scrapeAndCreateEntityEffect =
  (db: typeof DbType, scraper: MusicLinkScraperService) =>
  (entityType: MusicEntityType, input: MusicScrapeInput) =>
    Effect.gen(function* () {
      if (input.url) {
        const existingLinks = yield* findExistingEntityByUrl(db)(
          input.url,
          entityType
        )
        const match = existingLinks[0]
        if (match) {
          const entity = yield* Effect.catchTag(
            getEntityById(db)(
              match.entityType as MusicEntityType,
              match.entityId
            ),
            'NotFoundError',
            () => Effect.succeed(null)
          )
          if (entity) {
            const links = yield* getLinksForEntityEffect(db)(
              match.entityType as MusicEntityType,
              match.entityId
            )
            yield* Effect.logInfo(
              `[MusicEntity] URL already scraped, returning existing ${match.entityType}:${match.entityId}`
            )
            return { entity, links }
          }
        }
      }

      const result = yield* scraper.scrape(input)
      const meta = result.entityMeta

      const rawArtistName = meta?.artistName ?? input.artistName
      const foundArtists =
        rawArtistName && (entityType === 'album' || entityType === 'track')
          ? yield* findOrCreateArtistsByName(db)(
              parseArtistNames(rawArtistName)
            )
          : undefined
      const artistNames = foundArtists?.map((a) => a.name)
      const artistIds = foundArtists?.map((a) => a.id)

      const entity = yield* (() => {
        switch (entityType) {
          case 'artist': {
            const name =
              meta?.artistName ?? input.artistName ?? 'Unknown Artist'
            return findOrCreateArtist(db)(name, {
              imageUrl: meta?.thumbnailUrl
            })
          }
          case 'album': {
            const title = meta?.title ?? input.albumTitle ?? 'Untitled Album'
            return createAlbumEffect(db)({
              title,
              slug: toSlug(title),
              artistNames,
              artistIds,
              coverImageUrl: meta?.thumbnailUrl
            })
          }
          case 'track': {
            const title = meta?.title ?? input.trackTitle ?? 'Untitled Track'
            return createTrackEffect(db)({
              title,
              slug: toSlug(title),
              artistNames,
              artistIds,
              coverImageUrl: meta?.thumbnailUrl
            })
          }
          case 'playlist': {
            const title = meta?.title ?? 'Untitled Playlist'
            return createPlaylistEffect(db)({
              title,
              slug: toSlug(title),
              coverImageUrl: meta?.thumbnailUrl
            })
          }
        }
      })()

      const entityId = entity.id
      const inserted: SelectMusicEntityLink[] = []
      for (const link of result.links) {
        const row = yield* Effect.catch(
          addLinkEffect(db)({
            entityType,
            entityId,
            platform: link.platform,
            url: link.url,
            status: 'pending_review',
            scrapedAt: link.scrapedAt,
            metadata: link.metadata
          }),
          (e) =>
            Effect.andThen(
              Effect.logWarning(
                `Failed to persist scraped link ${link.platform}: ${e.message}`
              ),
              Effect.succeed(null as SelectMusicEntityLink | null)
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
