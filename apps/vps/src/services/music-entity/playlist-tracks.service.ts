import { LINK_STATUS } from '@gbfm/core/status'
import { and, eq, inArray, sql } from 'drizzle-orm'
import { Effect } from 'effect'
import type { db as DbType } from '@/db'
import {
  musicEntityLinksTable,
  musicPlaylistsTable,
  musicPlaylistTracksTable,
  musicTracksTable,
  type SelectMusicEntityLink,
  type SelectMusicPlaylist
} from '@/db/music-entity.schema'
import { DatabaseError, getErrorMessage, SpotifyError } from '@/errors'
import type { MusicLinkScraperService } from '@/services/music-link-scraper.service'
import type { S3Service } from '@/services/s3.service'
import {
  getIdFromSpotifyUrl,
  type SpotifyImportPlaylist,
  type SpotifyService
} from '@/services/spotify.service'
import { toSlug } from '@/services/to-slug'
import { addLinkEffect, getLinksForEntityEffect } from './link.service'
import {
  FetchError,
  findEntityIdBySpotifyUrlTx,
  type ImportedTrackTarget,
  requireInserted,
  uniqueSlug
} from './shared'
import { updateTrackEffect } from './track.service'

export const getPlaylistTracksEffect = (db: typeof DbType) => (playlistId: string) =>
  Effect.tryPromise({
    try: async () => {
      const rows = await db
        .select({
          track: musicTracksTable,
          position: musicPlaylistTracksTable.position,
          addedAt: musicPlaylistTracksTable.addedAt
        })
        .from(musicPlaylistTracksTable)
        .innerJoin(musicTracksTable, eq(musicPlaylistTracksTable.trackId, musicTracksTable.id))
        .where(eq(musicPlaylistTracksTable.playlistId, playlistId))
        .orderBy(musicPlaylistTracksTable.position)

      const trackIds = rows.map((r) => r.track.id)
      const linkRows =
        trackIds.length === 0
          ? []
          : await db
              .select()
              .from(musicEntityLinksTable)
              .where(
                and(
                  eq(musicEntityLinksTable.entityType, 'track'),
                  inArray(musicEntityLinksTable.entityId, trackIds)
                )
              )

      const linksByTrackId = new Map<string, SelectMusicEntityLink[]>()
      for (const link of linkRows) {
        const list = linksByTrackId.get(link.entityId) ?? []
        list.push(link)
        linksByTrackId.set(link.entityId, list)
      }

      return rows.map((r) => ({
        ...r,
        links: linksByTrackId.get(r.track.id) ?? []
      }))
    },
    catch: (e) =>
      new DatabaseError({
        message: `Failed to get playlist tracks: ${getErrorMessage(e)}`,
        operation: 'select',
        table: 'music_playlist_tracks'
      })
  }).pipe(
    Effect.withSpan('musicEntity.getPlaylistTracks', {
      attributes: { playlistId }
    })
  )

export const addTrackToPlaylistEffect = (db: typeof DbType) =>
  Effect.fn('musicEntity.addTrackToPlaylist')(function* (
    playlistId: string,
    trackId: string,
    position: number
  ) {
    const rows = yield* Effect.tryPromise({
      try: () =>
        db
          .insert(musicPlaylistTracksTable)
          .values({ playlistId, trackId, position })
          .onConflictDoUpdate({
            target: [musicPlaylistTracksTable.playlistId, musicPlaylistTracksTable.trackId],
            set: { position }
          })
          .returning(),
      catch: (e) =>
        new DatabaseError({
          message: `Failed to add track to playlist: ${getErrorMessage(e)}`,
          operation: 'insert',
          table: 'music_playlist_tracks'
        })
    })
    return yield* requireInserted(rows, 'music_playlist_tracks')
  })

export const removeTrackFromPlaylistEffect =
  (db: typeof DbType) => (playlistId: string, trackId: string) =>
    Effect.tryPromise({
      try: () =>
        db
          .delete(musicPlaylistTracksTable)
          .where(
            and(
              eq(musicPlaylistTracksTable.playlistId, playlistId),
              eq(musicPlaylistTracksTable.trackId, trackId)
            )
          ),
      catch: (e) =>
        new DatabaseError({
          message: `Failed to remove track from playlist: ${getErrorMessage(e)}`,
          operation: 'delete',
          table: 'music_playlist_tracks'
        })
    }).pipe(
      Effect.asVoid,
      Effect.withSpan('musicEntity.removeTrackFromPlaylist', {
        attributes: { playlistId, trackId }
      })
    )

export const reorderPlaylistTracksEffect =
  (db: typeof DbType) => (playlistId: string, trackIds: string[]) =>
    Effect.tryPromise({
      try: () =>
        db.transaction(async (tx) => {
          const existing = await tx
            .select({ trackId: musicPlaylistTracksTable.trackId })
            .from(musicPlaylistTracksTable)
            .where(eq(musicPlaylistTracksTable.playlistId, playlistId))

          const existingSet = new Set(existing.map((r) => r.trackId))
          const incomingSet = new Set(trackIds)

          if (
            existingSet.size !== incomingSet.size ||
            [...existingSet].some((id) => !incomingSet.has(id))
          ) {
            throw new DatabaseError({
              message: 'Reorder track set must match current playlist tracks exactly',
              operation: 'update',
              table: 'music_playlist_tracks'
            })
          }

          for (let i = 0; i < trackIds.length; i += 1) {
            const trackId = trackIds[i]
            if (!trackId) {
              throw new DatabaseError({
                message: 'Reorder track payload contained an empty track id',
                operation: 'update',
                table: 'music_playlist_tracks'
              })
            }

            await tx
              .update(musicPlaylistTracksTable)
              .set({ position: i })
              .where(
                and(
                  eq(musicPlaylistTracksTable.playlistId, playlistId),
                  eq(musicPlaylistTracksTable.trackId, trackId)
                )
              )
          }
        }),
      catch: (e) =>
        e instanceof DatabaseError
          ? e
          : new DatabaseError({
              message: `Failed to reorder tracks: ${getErrorMessage(e)}`,
              operation: 'update',
              table: 'music_playlist_tracks'
            })
    }).pipe(
      Effect.asVoid,
      Effect.withSpan('musicEntity.reorderPlaylistTracks', {
        attributes: { playlistId }
      })
    )

const copyCoverImageToCdnEffect = (
  s3: S3Service,
  cdnUrl: string,
  bucketName: string,
  entityType: string,
  entityId: string,
  coverImageUrl: string
) =>
  Effect.gen(function* () {
    const response = yield* Effect.tryPromise({
      try: () => fetch(coverImageUrl),
      catch: (cause) => new FetchError({ message: `Failed to fetch ${coverImageUrl}`, cause })
    })

    if (!response.ok) return null

    const contentType = response.headers.get('content-type') || 'image/jpeg'
    const arrayBuffer = yield* Effect.tryPromise({
      try: () => response.arrayBuffer(),
      catch: (cause) => new FetchError({ message: `Failed to read ${coverImageUrl}`, cause })
    })
    const buffer = Buffer.from(arrayBuffer)
    const key = `music/${entityType}/${entityId}/cover`
    const uploadedKey = yield* s3.uploadFile(key, buffer, contentType, bucketName)

    return `${cdnUrl}/user-content/${uploadedKey}`
  }).pipe(Effect.catch(() => Effect.succeed(null)))

const enrichTrackLinksEffect = (
  db: typeof DbType,
  scraper: MusicLinkScraperService,
  s3: S3Service,
  cdnUrl: string,
  bucketName: string,
  playlistId: string,
  track: ImportedTrackTarget
) =>
  Effect.gen(function* () {
    const existingLinks = yield* getLinksForEntityEffect(db)('track', track.trackId)
    const existingPlatforms = new Set(existingLinks.map((link) => link.platform))

    const scraped = yield* scraper.scrape({
      url: track.trackUrl,
      trackTitle: track.title,
      artistName: track.artistNames.join(', ')
    })

    const linksToAdd = scraped.links.filter(
      (link) => link.platform !== 'spotify' && !existingPlatforms.has(link.platform)
    )

    const persistedLinks = yield* Effect.forEach(
      linksToAdd,
      (link) =>
        Effect.catch(
          addLinkEffect(db)({
            entityType: 'track',
            entityId: track.trackId,
            platform: link.platform,
            url: link.url,
            status: LINK_STATUS.PENDING_REVIEW,
            scrapedAt: link.scrapedAt,
            metadata: link.metadata
          }),
          (error) =>
            Effect.andThen(
              Effect.logWarning('[MusicEntity] Failed to persist scraped track link', {
                playlistId,
                trackId: track.trackId,
                platform: link.platform,
                error: getErrorMessage(error)
              }),
              Effect.succeed<SelectMusicEntityLink | null>(null)
            )
        ),
      { concurrency: 1 }
    )

    if (scraped.entityMeta?.thumbnailUrl) {
      const publicCoverImageUrl = yield* copyCoverImageToCdnEffect(
        s3,
        cdnUrl,
        bucketName,
        'track',
        track.trackId,
        scraped.entityMeta.thumbnailUrl
      )

      if (publicCoverImageUrl) {
        yield* updateTrackEffect(db)(track.trackId, {
          coverImageUrl: publicCoverImageUrl
        })
      }
    }

    return {
      scrapedCount: linksToAdd.length,
      insertedCount: persistedLinks.filter((link) => link !== null).length
    }
  }).pipe(
    Effect.withSpan('musicEntity.enrichTrackLinks', {
      attributes: {
        playlistId,
        trackId: track.trackId,
        sourceUrl: track.trackUrl,
        artistCount: track.artistNames.length
      }
    })
  )

const enrichImportedPlaylistLinksEffect = (
  db: typeof DbType,
  scraper: MusicLinkScraperService,
  s3: S3Service,
  cdnUrl: string,
  bucketName: string,
  playlistId: string,
  tracks: ImportedTrackTarget[]
) =>
  Effect.gen(function* () {
    yield* Effect.logInfo('[MusicEntity] Starting background playlist link enrichment', {
      playlistId,
      trackCount: tracks.length
    })

    const results = yield* Effect.forEach(
      tracks,
      (track) => enrichTrackLinksEffect(db, scraper, s3, cdnUrl, bucketName, playlistId, track),
      { concurrency: 1 }
    )

    const insertedCount = results.reduce((sum, r) => sum + r.insertedCount, 0)

    yield* Effect.logInfo('[MusicEntity] Completed background playlist link enrichment', {
      playlistId,
      trackCount: tracks.length,
      insertedCount
    })

    return { insertedCount }
  }).pipe(
    Effect.withSpan('musicEntity.enrichImportedPlaylistLinks', {
      attributes: { playlistId, trackCount: tracks.length }
    }),
    Effect.catch((error) =>
      Effect.logError('[MusicEntity] Background playlist link enrichment failed', {
        playlistId,
        error: getErrorMessage(error)
      })
    )
  )

const getPlaylistLinkSyncTargetsEffect = (db: typeof DbType) => (playlistId: string) =>
  Effect.gen(function* () {
    const rows = yield* getPlaylistTracksEffect(db)(playlistId)
    return rows.flatMap((row) => {
      const spotifyLink = row.links.find((link) => link.platform === 'spotify')
      if (!spotifyLink) return []
      return [
        {
          trackId: row.track.id,
          trackUrl: spotifyLink.url,
          title: row.track.title,
          artistNames: row.track.artistNames ?? []
        } satisfies ImportedTrackTarget
      ]
    })
  }).pipe(
    Effect.withSpan('musicEntity.getPlaylistLinkSyncTargets', {
      attributes: { playlistId }
    })
  )

const getSpotifyPlaylistUrlEffect = (db: typeof DbType) => (playlistId: string) =>
  Effect.tryPromise({
    try: async () => {
      const rows = await db
        .select({ url: musicEntityLinksTable.url })
        .from(musicEntityLinksTable)
        .where(
          and(
            eq(musicEntityLinksTable.entityType, 'playlist'),
            eq(musicEntityLinksTable.entityId, playlistId),
            eq(musicEntityLinksTable.platform, 'spotify')
          )
        )
        .limit(1)
      return rows[0]?.url ?? null
    },
    catch: (e) =>
      new DatabaseError({
        message: `Failed to load playlist Spotify URL: ${getErrorMessage(e)}`,
        operation: 'select',
        table: 'music_entity_links'
      })
  }).pipe(
    Effect.withSpan('musicEntity.getSpotifyPlaylistUrl', {
      attributes: { playlistId }
    })
  )

const refreshPlaylistCoverImageEffect = (
  db: typeof DbType,
  spotify: SpotifyService,
  s3: S3Service,
  cdnUrl: string,
  bucketName: string,
  playlistId: string
) =>
  Effect.gen(function* () {
    const spotifyUrl = yield* getSpotifyPlaylistUrlEffect(db)(playlistId)
    if (!spotifyUrl) return { updated: false as const }

    const spotifyPlaylistId = getIdFromSpotifyUrl(spotifyUrl)
    if (!spotifyPlaylistId) return { updated: false as const }

    const data = yield* spotify.getPlaylistForImport(spotifyPlaylistId)
    if (!data.coverImageUrl) return { updated: false as const }

    const publicCoverImageUrl = yield* copyCoverImageToCdnEffect(
      s3,
      cdnUrl,
      bucketName,
      'playlist',
      playlistId,
      data.coverImageUrl
    )

    if (!publicCoverImageUrl || publicCoverImageUrl === data.coverImageUrl) {
      return { updated: false as const }
    }

    const updated = yield* Effect.tryPromise({
      try: () =>
        db
          .update(musicPlaylistsTable)
          .set({ coverImageUrl: publicCoverImageUrl, updatedAt: new Date() })
          .where(eq(musicPlaylistsTable.id, playlistId))
          .returning(),
      catch: (e) =>
        new DatabaseError({
          message: `Failed to update playlist cover image: ${getErrorMessage(e)}`,
          operation: 'update',
          table: 'music_playlists'
        })
    })

    if (!updated[0]) return { updated: false as const }

    return { updated: true as const, coverImageUrl: publicCoverImageUrl }
  }).pipe(
    Effect.withSpan('musicEntity.refreshPlaylistCoverImage', {
      attributes: { playlistId }
    })
  )

export const addSpotifyTrackToPlaylistEffect = (db: typeof DbType, spotify: SpotifyService) =>
  Effect.fn('musicEntity.addSpotifyTrackToPlaylist')(function* (
    playlistId: string,
    spotifyUrl: string
  ) {
    const id = getIdFromSpotifyUrl(spotifyUrl)
    if (!id) {
      return yield* new SpotifyError({
        message: 'Could not extract Spotify track ID from URL',
        operation: 'addSpotifyTrackToPlaylist',
        statusCode: 400
      })
    }

    const t = yield* spotify.getTrackForImport(id)

    return yield* Effect.tryPromise({
      try: () =>
        db.transaction(async (tx) => {
          const existingTrackId = await findEntityIdBySpotifyUrlTx(tx, 'track', t.trackUrl)

          let trackId: string
          let created = false
          if (existingTrackId) {
            trackId = existingTrackId
          } else {
            const slug = await uniqueSlug(
              tx,
              musicTracksTable,
              toSlug(`${t.artistNames.join(' ')} ${t.title}`)
            )
            const inserted = await tx
              .insert(musicTracksTable)
              .values({
                title: t.title,
                artistNames: t.artistNames,
                coverImageUrl: t.albumImageUrl,
                trackNumber: t.trackNumber,
                slug
              })
              .returning()
            const row = inserted[0]
            if (!row) throw new Error('Failed to insert track')
            trackId = row.id
            created = true

            await tx.insert(musicEntityLinksTable).values({
              entityType: 'track',
              entityId: trackId,
              platform: 'spotify',
              url: t.trackUrl,
              status: LINK_STATUS.VERIFIED,
              metadata: {
                spotifyTrackId: t.spotifyTrackId,
                durationMs: t.durationMs,
                previewUrl: t.previewUrl,
                albumName: t.albumName,
                albumSpotifyId: t.albumSpotifyId
              }
            })
          }

          const maxRow = await tx
            .select({
              max: sql<number | null>`max(${musicPlaylistTracksTable.position})`
            })
            .from(musicPlaylistTracksTable)
            .where(eq(musicPlaylistTracksTable.playlistId, playlistId))
          const nextPosition = (maxRow[0]?.max ?? -1) + 1

          await tx
            .insert(musicPlaylistTracksTable)
            .values({ playlistId, trackId, position: nextPosition })
            .onConflictDoNothing({
              target: [musicPlaylistTracksTable.playlistId, musicPlaylistTracksTable.trackId]
            })

          const finalRow = await tx
            .select({ position: musicPlaylistTracksTable.position })
            .from(musicPlaylistTracksTable)
            .where(
              and(
                eq(musicPlaylistTracksTable.playlistId, playlistId),
                eq(musicPlaylistTracksTable.trackId, trackId)
              )
            )
            .limit(1)

          return {
            trackId,
            position: finalRow[0]?.position ?? nextPosition,
            created
          }
        }),
      catch: (e) =>
        new DatabaseError({
          message: `Failed to add Spotify track: ${getErrorMessage(e)}`,
          operation: 'insert',
          table: 'music_playlist_tracks'
        })
    })
  })

export const importSpotifyPlaylistEffect = (
  db: typeof DbType,
  spotify: SpotifyService,
  scraper: MusicLinkScraperService,
  s3: S3Service,
  cdnUrl: string,
  bucketName: string
) =>
  Effect.fn('musicEntity.importSpotifyPlaylist')(function* (
    url: string,
    curatorId?: string | null
  ) {
    const id = getIdFromSpotifyUrl(url)
    if (!id) {
      return yield* new SpotifyError({
        message: 'Could not extract Spotify playlist ID from URL',
        operation: 'importSpotifyPlaylist',
        statusCode: 400
      })
    }

    const data: SpotifyImportPlaylist = yield* spotify.getPlaylistForImport(id)
    const storedCoverImageUrl = data.coverImageUrl
      ? yield* copyCoverImageToCdnEffect(s3, cdnUrl, bucketName, 'playlist', id, data.coverImageUrl)
      : null
    const importedTracks: ImportedTrackTarget[] = []

    const result = yield* Effect.tryPromise({
      try: () =>
        db.transaction(async (tx) => {
          let createdTrackCount = 0
          let reusedTrackCount = 0

          const existingPlaylistId = await findEntityIdBySpotifyUrlTx(
            tx,
            'playlist',
            data.playlistUrl
          )

          const existingPlaylistCuratorId = existingPlaylistId
            ? ((
                await tx
                  .select({ curatorId: musicPlaylistsTable.curatorId })
                  .from(musicPlaylistsTable)
                  .where(eq(musicPlaylistsTable.id, existingPlaylistId))
                  .limit(1)
              )[0]?.curatorId ?? null)
            : null
          const playlistCuratorId = existingPlaylistCuratorId ?? curatorId ?? null

          let playlist: SelectMusicPlaylist
          if (existingPlaylistId) {
            const updated = await tx
              .update(musicPlaylistsTable)
              .set({
                title: data.title,
                description: data.description,
                coverImageUrl: storedCoverImageUrl ?? data.coverImageUrl,
                curatorId: playlistCuratorId,
                updatedAt: new Date()
              })
              .where(eq(musicPlaylistsTable.id, existingPlaylistId))
              .returning()
            const row = updated[0]
            if (!row) throw new Error('Failed to update existing playlist')
            playlist = row
          } else {
            const slug = await uniqueSlug(tx, musicPlaylistsTable, toSlug(data.title))
            const inserted = await tx
              .insert(musicPlaylistsTable)
              .values({
                title: data.title,
                description: data.description,
                coverImageUrl: storedCoverImageUrl ?? data.coverImageUrl,
                curatorId: playlistCuratorId,
                slug
              })
              .returning()
            const row = inserted[0]
            if (!row) throw new Error('Failed to insert playlist')
            playlist = row

            await tx.insert(musicEntityLinksTable).values({
              entityType: 'playlist',
              entityId: playlist.id,
              platform: 'spotify',
              url: data.playlistUrl,
              status: LINK_STATUS.VERIFIED,
              metadata: { spotifyPlaylistId: data.spotifyPlaylistId }
            })
          }

          await tx
            .delete(musicPlaylistTracksTable)
            .where(eq(musicPlaylistTracksTable.playlistId, playlist.id))

          for (let i = 0; i < data.tracks.length; i += 1) {
            const t = data.tracks[i]
            if (!t) continue

            const existingTrackId = await findEntityIdBySpotifyUrlTx(tx, 'track', t.trackUrl)

            let trackId: string
            if (existingTrackId) {
              trackId = existingTrackId
              reusedTrackCount += 1
            } else {
              const slug = await uniqueSlug(
                tx,
                musicTracksTable,
                toSlug(`${t.artistNames.join(' ')} ${t.title}`)
              )
              const inserted = await tx
                .insert(musicTracksTable)
                .values({
                  title: t.title,
                  artistNames: t.artistNames,
                  coverImageUrl: t.albumImageUrl,
                  trackNumber: t.trackNumber,
                  slug
                })
                .returning()
              const row = inserted[0]
              if (!row) throw new Error('Failed to insert track')
              trackId = row.id
              createdTrackCount += 1

              await tx.insert(musicEntityLinksTable).values({
                entityType: 'track',
                entityId: trackId,
                platform: 'spotify',
                url: t.trackUrl,
                status: LINK_STATUS.VERIFIED,
                metadata: {
                  spotifyTrackId: t.spotifyTrackId,
                  durationMs: t.durationMs,
                  previewUrl: t.previewUrl,
                  albumName: t.albumName,
                  albumSpotifyId: t.albumSpotifyId
                }
              })
            }

            await tx
              .insert(musicPlaylistTracksTable)
              .values({ playlistId: playlist.id, trackId, position: i })
              .onConflictDoUpdate({
                target: [musicPlaylistTracksTable.playlistId, musicPlaylistTracksTable.trackId],
                set: { position: i }
              })

            importedTracks.push({
              trackId,
              trackUrl: t.trackUrl,
              title: t.title,
              artistNames: t.artistNames
            })
          }

          return {
            playlist,
            trackCount: data.tracks.length,
            createdTrackCount,
            reusedTrackCount
          }
        }),
      catch: (e) =>
        new DatabaseError({
          message: `Failed to import Spotify playlist: ${getErrorMessage(e)}`,
          operation: 'insert',
          table: 'music_playlists'
        })
    })

    if (importedTracks.length > 0) {
      yield* Effect.logInfo('[MusicEntity] Scheduling background playlist link enrichment', {
        playlistId: result.playlist.id,
        trackCount: importedTracks.length
      })

      yield* enrichImportedPlaylistLinksEffect(
        db,
        scraper,
        s3,
        cdnUrl,
        bucketName,
        result.playlist.id,
        importedTracks
      ).pipe(Effect.forkDetach)
    }

    return result
  })

export const syncPlaylistLinksEffect = (
  db: typeof DbType,
  spotify: SpotifyService,
  scraper: MusicLinkScraperService,
  s3: S3Service,
  cdnUrl: string,
  bucketName: string
) =>
  Effect.fn('musicEntity.syncPlaylistLinks')(function* (playlistId: string) {
    yield* refreshPlaylistCoverImageEffect(db, spotify, s3, cdnUrl, bucketName, playlistId)

    const targets = yield* getPlaylistLinkSyncTargetsEffect(db)(playlistId)

    if (targets.length === 0) return { playlistId, queuedTrackCount: 0 }

    yield* Effect.logInfo('[MusicEntity] Scheduling manual playlist link sync', {
      playlistId,
      trackCount: targets.length
    })

    yield* enrichImportedPlaylistLinksEffect(
      db,
      scraper,
      s3,
      cdnUrl,
      bucketName,
      playlistId,
      targets
    ).pipe(Effect.forkDetach)

    return { playlistId, queuedTrackCount: targets.length }
  })
