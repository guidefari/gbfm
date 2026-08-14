import { LINK_STATUS } from '@gbfm/core/status'
import { and, eq, inArray, sql } from 'drizzle-orm'
import { Effect } from 'effect'
import { Database } from '@/db/layer'
import {
  musicEntityLinksTable,
  musicPlaylistsTable,
  musicPlaylistTracksTable,
  musicTracksTable,
  type SelectMusicEntityLink
} from '@/db/music-entity.schema'
import { DatabaseError, getErrorMessage, SpotifyError } from '@/errors'
import type { MusicLinkScraperService } from '@/services/music-link-scraper.service'
import type { S3Service } from '@/services/s3.service'
import {
  getIdFromSpotifyUrl,
  type SpotifyImportPlaylist,
  type SpotifyService
} from '@/services/spotify.service'
import { addLinkEffect, getLinksForEntityEffect } from './link.service'
import { type SpotifyImportResolverContract } from '@/services/spotify-import-resolver.service'
import { FetchError, type ImportedTrackTarget, requireInserted } from './shared'
import { updateTrackEffect } from './track.service'

export const getPlaylistTracksEffect = (playlistId: string) =>
  Effect.gen(function* () {
    const db = yield* Database
    return yield* Effect.tryPromise({
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
    })
  }).pipe(
    Effect.withSpan('musicEntity.getPlaylistTracks', {
      attributes: { playlistId }
    })
  )

export const addTrackToPlaylistEffect = Effect.fn('musicEntity.addTrackToPlaylist')(function* (
  playlistId: string,
  trackId: string,
  position: number
) {
  const db = yield* Database
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

export const removeTrackFromPlaylistEffect = (playlistId: string, trackId: string) =>
  Effect.gen(function* () {
    const db = yield* Database
    yield* Effect.tryPromise({
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
    })
  }).pipe(
    Effect.withSpan('musicEntity.removeTrackFromPlaylist', {
      attributes: { playlistId, trackId }
    })
  )

export const reorderPlaylistTracksEffect = (playlistId: string, trackIds: string[]) =>
  Effect.gen(function* () {
    const db = yield* Database
    yield* Effect.tryPromise({
      try: async () => {
        for (let attempt = 0; attempt < 3; attempt += 1) {
          const playlistRows = await db
            .select({ revision: musicPlaylistsTable.revision })
            .from(musicPlaylistsTable)
            .where(eq(musicPlaylistsTable.id, playlistId))
            .limit(1)
          const playlist = playlistRows[0]
          if (!playlist) {
            throw new DatabaseError({
              message: 'Playlist not found',
              operation: 'update',
              table: 'music_playlists'
            })
          }

          const existing = await db
            .select({ trackId: musicPlaylistTracksTable.trackId })
            .from(musicPlaylistTracksTable)
            .where(eq(musicPlaylistTracksTable.playlistId, playlistId))

          const existingSet = new Set(existing.map((row) => row.trackId))
          const incomingSet = new Set(trackIds)
          if (
            existingSet.size !== incomingSet.size ||
            [...existingSet].some((trackId) => !incomingSet.has(trackId))
          ) {
            throw new DatabaseError({
              message: 'Reorder track set must match current playlist tracks exactly',
              operation: 'update',
              table: 'music_playlist_tracks'
            })
          }

          const revision = playlist.revision + 1
          const [advanced] = await db.batch([
            db
              .update(musicPlaylistsTable)
              .set({ revision, updatedAt: new Date() })
              .where(
                and(
                  eq(musicPlaylistsTable.id, playlistId),
                  eq(musicPlaylistsTable.revision, playlist.revision)
                )
              )
              .returning({ id: musicPlaylistsTable.id }),
            ...trackIds.map((trackId, position) =>
              db
                .update(musicPlaylistTracksTable)
                .set({ position })
                .where(
                  and(
                    eq(musicPlaylistTracksTable.playlistId, playlistId),
                    eq(musicPlaylistTracksTable.trackId, trackId),
                    sql`exists (
                      select 1
                      from ${musicPlaylistsTable}
                      where ${musicPlaylistsTable.id} = ${playlistId}
                        and ${musicPlaylistsTable.revision} = ${revision}
                    )`
                  )
                )
            )
          ])
          if (advanced.length > 0) return
        }

        throw new DatabaseError({
          message: 'Playlist changed while reordering tracks',
          operation: 'update',
          table: 'music_playlist_tracks'
        })
      },
      catch: (e) =>
        e instanceof DatabaseError
          ? e
          : new DatabaseError({
              message: `Failed to reorder tracks: ${getErrorMessage(e)}`,
              operation: 'update',
              table: 'music_playlist_tracks'
            })
    })
  }).pipe(
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
  scraper: MusicLinkScraperService,
  s3: S3Service,
  cdnUrl: string,
  bucketName: string,
  playlistId: string,
  track: ImportedTrackTarget
) =>
  Effect.gen(function* () {
    const existingLinks = yield* getLinksForEntityEffect('track', track.trackId)
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
          addLinkEffect({
            entityType: 'track',
            entityId: track.trackId,
            platform: link.platform,
            url: link.url,
            status: LINK_STATUS.VERIFIED,
            verifiedAt: link.scrapedAt,
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
        yield* updateTrackEffect(track.trackId, {
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
      (track) => enrichTrackLinksEffect(scraper, s3, cdnUrl, bucketName, playlistId, track),
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

const getPlaylistLinkSyncTargetsEffect = (playlistId: string) =>
  Effect.gen(function* () {
    const rows = yield* getPlaylistTracksEffect(playlistId)
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

const getSpotifyPlaylistUrlEffect = (playlistId: string) =>
  Effect.gen(function* () {
    const db = yield* Database
    return yield* Effect.tryPromise({
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
    })
  }).pipe(
    Effect.withSpan('musicEntity.getSpotifyPlaylistUrl', {
      attributes: { playlistId }
    })
  )

const refreshPlaylistCoverImageEffect = (
  spotify: SpotifyService,
  s3: S3Service,
  cdnUrl: string,
  bucketName: string,
  playlistId: string
) =>
  Effect.gen(function* () {
    const db = yield* Database
    const spotifyUrl = yield* getSpotifyPlaylistUrlEffect(playlistId)
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

export const addSpotifyTrackToPlaylistEffect = (
  spotify: SpotifyService,
  resolver: SpotifyImportResolverContract
) =>
  Effect.fn('musicEntity.addSpotifyTrackToPlaylist')(function* (
    playlistId: string,
    spotifyUrl: string
  ) {
    const db = yield* Database
    const id = getIdFromSpotifyUrl(spotifyUrl)
    if (!id) {
      return yield* new SpotifyError({
        message: 'Could not extract Spotify track ID from URL',
        operation: 'addSpotifyTrackToPlaylist',
        statusCode: 400
      })
    }

    const t = yield* spotify.getTrackForImport(id)
    const track = yield* resolver.resolveTrack(t)

    return yield* Effect.tryPromise({
      try: async () => {
        await db.batch([
          db
            .insert(musicPlaylistTracksTable)
            .select(
              db
                .select({
                  playlistId: sql<string>`${playlistId}`.as('playlistId'),
                  trackId: sql<string>`${track.trackId}`.as('trackId'),
                  position:
                    sql<number>`coalesce(max(${musicPlaylistTracksTable.position}), -1) + 1`.as(
                      'position'
                    ),
                  addedAt: sql<Date>`${Date.now()}`.as('addedAt')
                })
                .from(musicPlaylistsTable)
                .leftJoin(
                  musicPlaylistTracksTable,
                  eq(musicPlaylistTracksTable.playlistId, musicPlaylistsTable.id)
                )
                .where(eq(musicPlaylistsTable.id, playlistId))
                .groupBy(musicPlaylistsTable.id)
            )
            .onConflictDoNothing({
              target: [musicPlaylistTracksTable.playlistId, musicPlaylistTracksTable.trackId]
            })
        ])

        const finalRows = await db
          .select({ position: musicPlaylistTracksTable.position })
          .from(musicPlaylistTracksTable)
          .where(
            and(
              eq(musicPlaylistTracksTable.playlistId, playlistId),
              eq(musicPlaylistTracksTable.trackId, track.trackId)
            )
          )
          .limit(1)
        const final = finalRows[0]
        if (!final) throw new Error('Failed to add Spotify track to playlist')

        return { trackId: track.trackId, position: final.position, created: track.created }
      },
      catch: (e) =>
        new DatabaseError({
          message: `Failed to add Spotify track: ${getErrorMessage(e)}`,
          operation: 'insert',
          table: 'music_playlist_tracks'
        })
    })
  })

export const importSpotifyPlaylistEffect = (
  spotify: SpotifyService,
  resolver: SpotifyImportResolverContract,
  scraper: MusicLinkScraperService,
  s3: S3Service,
  cdnUrl: string,
  bucketName: string
) =>
  Effect.fn('musicEntity.importSpotifyPlaylist')(function* (
    url: string,
    curatorId?: string | null
  ) {
    const db = yield* Database
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
    const playlist = yield* resolver.resolvePlaylist(data, storedCoverImageUrl, curatorId)
    const tracks = yield* Effect.forEach(data.tracks, (track) => resolver.resolveTrack(track))
    const result = yield* Effect.tryPromise({
      try: async () => {
        for (let attempt = 0; attempt < 3; attempt += 1) {
          const playlistRows = await db
            .select()
            .from(musicPlaylistsTable)
            .where(eq(musicPlaylistsTable.id, playlist.id))
            .limit(1)
          const current = playlistRows[0]
          if (!current) throw new Error('Spotify playlist no longer exists')
          const revision = current.revision + 1
          const [advanced] = await db.batch([
            db
              .update(musicPlaylistsTable)
              .set({
                title: data.title,
                description: data.description,
                coverImageUrl: storedCoverImageUrl ?? data.coverImageUrl,
                curatorId: current.curatorId ?? curatorId ?? null,
                revision,
                updatedAt: new Date()
              })
              .where(
                and(
                  eq(musicPlaylistsTable.id, current.id),
                  eq(musicPlaylistsTable.revision, current.revision)
                )
              )
              .returning({ id: musicPlaylistsTable.id }),
            db.delete(musicPlaylistTracksTable).where(
              and(
                eq(musicPlaylistTracksTable.playlistId, current.id),
                sql`exists (
                    select 1
                    from ${musicPlaylistsTable}
                    where ${musicPlaylistsTable.id} = ${current.id}
                      and ${musicPlaylistsTable.revision} = ${revision}
                  )`
              )
            ),
            ...tracks.map((track, position) =>
              db
                .insert(musicPlaylistTracksTable)
                .select(
                  db
                    .select({
                      playlistId: sql<string>`${current.id}`.as('playlistId'),
                      trackId: sql<string>`${track.trackId}`.as('trackId'),
                      position: sql<number>`${position}`.as('position'),
                      addedAt: sql<Date>`${Date.now()}`.as('addedAt')
                    })
                    .from(musicPlaylistsTable)
                    .where(
                      and(
                        eq(musicPlaylistsTable.id, current.id),
                        eq(musicPlaylistsTable.revision, revision)
                      )
                    )
                )
                .onConflictDoUpdate({
                  target: [musicPlaylistTracksTable.playlistId, musicPlaylistTracksTable.trackId],
                  set: { position }
                })
            )
          ])
          if (advanced.length === 0) continue

          const resultRows = await db
            .select()
            .from(musicPlaylistsTable)
            .where(eq(musicPlaylistsTable.id, current.id))
            .limit(1)
          const updated = resultRows[0]
          if (!updated) throw new Error('Spotify playlist no longer exists')

          return {
            playlist: updated,
            trackCount: data.tracks.length,
            createdTrackCount: tracks.filter((track) => track.created).length,
            reusedTrackCount: tracks.filter((track) => !track.created).length,
            importedTracks: data.tracks.flatMap((track, index) => {
              const resolved = tracks[index]
              return resolved
                ? [
                    {
                      trackId: resolved.trackId,
                      trackUrl: track.trackUrl,
                      title: track.title,
                      artistNames: track.artistNames
                    }
                  ]
                : []
            })
          }
        }

        throw new Error('Spotify playlist changed while importing')
      },
      catch: (e) =>
        new DatabaseError({
          message: `Failed to import Spotify playlist: ${getErrorMessage(e)}`,
          operation: 'insert',
          table: 'music_playlists'
        })
    })

    if (result.importedTracks.length > 0) {
      yield* Effect.logInfo('[MusicEntity] Scheduling background playlist link enrichment', {
        playlistId: result.playlist.id,
        trackCount: result.importedTracks.length
      })

      yield* enrichImportedPlaylistLinksEffect(
        scraper,
        s3,
        cdnUrl,
        bucketName,
        result.playlist.id,
        result.importedTracks
      ).pipe(Effect.forkDetach)
    }

    const { importedTracks: _, ...importResult } = result
    return importResult
  })

export const syncPlaylistLinksEffect = (
  spotify: SpotifyService,
  scraper: MusicLinkScraperService,
  s3: S3Service,
  cdnUrl: string,
  bucketName: string
) =>
  Effect.fn('musicEntity.syncPlaylistLinks')(function* (playlistId: string) {
    yield* refreshPlaylistCoverImageEffect(spotify, s3, cdnUrl, bucketName, playlistId)

    const targets = yield* getPlaylistLinkSyncTargetsEffect(playlistId)

    if (targets.length === 0) return { playlistId, queuedTrackCount: 0 }

    yield* Effect.logInfo('[MusicEntity] Scheduling manual playlist link sync', {
      playlistId,
      trackCount: targets.length
    })

    yield* enrichImportedPlaylistLinksEffect(
      scraper,
      s3,
      cdnUrl,
      bucketName,
      playlistId,
      targets
    ).pipe(Effect.forkDetach)

    return { playlistId, queuedTrackCount: targets.length }
  })
