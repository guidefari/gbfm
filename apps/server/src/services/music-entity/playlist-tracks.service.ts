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
import { DatabaseError, getErrorMessage, MusicProviderInvalidInput } from '@/errors'
import { copyMusicCoverImageBestEffort } from '@/services/music-cover-image.service'
import type { CanonicalMusicIdentityService } from '@/services/canonical-music-identity'
import type { S3Service } from '@/services/s3.service'
import {
  getIdFromSpotifyUrl,
  type SpotifyImportPlaylist,
  type SpotifyImportTrack,
  type SpotifyService
} from '@/services/spotify.service'
import { type ImportedTrackTarget, requireInserted } from './shared'
import { updateTrackEffect } from './track.service'

type MusicArtworkStore = Pick<S3Service, 'uploadFile'>

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

const spotifyTrackSnapshot = (track: SpotifyImportTrack) => ({
  entityType: 'track' as const,
  sourceUrl: track.trackUrl,
  title: track.title,
  artistNames: track.artistNames,
  imageUrl: track.albumImageUrl ?? undefined,
  trackNumber: track.trackNumber ?? undefined,
  sourceMetadata: {
    spotifyTrackId: track.spotifyTrackId,
    durationMs: track.durationMs,
    previewUrl: track.previewUrl,
    albumName: track.albumName,
    albumSpotifyId: track.albumSpotifyId
  }
})

const enrichTrackLinksEffect = (
  identity: CanonicalMusicIdentityService,
  s3: MusicArtworkStore,
  cdnUrl: string,
  bucketName: string,
  playlistId: string,
  track: ImportedTrackTarget
) =>
  Effect.gen(function* () {
    const refreshed = yield* identity.enrichEntity({
      entityType: 'track',
      entityId: track.trackId,
      actorId: 'playlist_enrichment'
    })
    if (refreshed.artworkUrl) {
      const publicCoverImageUrl = yield* copyMusicCoverImageBestEffort(
        s3,
        cdnUrl,
        bucketName,
        'track',
        track.trackId,
        refreshed.artworkUrl
      )
      if (publicCoverImageUrl) {
        yield* updateTrackEffect(track.trackId, { coverImageUrl: publicCoverImageUrl })
      }
    }
    return { insertedCount: refreshed.links.filter((link) => link.platform !== 'spotify').length }
  }).pipe(
    Effect.withSpan('musicEntity.enrichTrackLinks', {
      attributes: { playlistId, trackId: track.trackId, artistCount: track.artistNames.length }
    })
  )

const enrichImportedPlaylistLinksEffect = (
  identity: CanonicalMusicIdentityService,
  s3: MusicArtworkStore,
  cdnUrl: string,
  bucketName: string,
  playlistId: string,
  tracks: ImportedTrackTarget[]
) =>
  Effect.gen(function* () {
    const uniqueTracks = [...new Map(tracks.map((track) => [track.trackId, track])).values()]
    const results = yield* Effect.forEach(
      uniqueTracks,
      (track) => enrichTrackLinksEffect(identity, s3, cdnUrl, bucketName, playlistId, track),
      { concurrency: 1 }
    )
    return { insertedCount: results.reduce((sum, result) => sum + result.insertedCount, 0) }
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

export const addSpotifyTrackToPlaylistEffect = (
  spotify: Pick<SpotifyService, 'getTrackForImport'>,
  identity: CanonicalMusicIdentityService
) =>
  Effect.fn('musicEntity.addSpotifyTrackToPlaylist')(function* (
    playlistId: string,
    spotifyUrl: string
  ) {
    const db = yield* Database
    const id = getIdFromSpotifyUrl(spotifyUrl)
    if (!id) {
      return yield* new MusicProviderInvalidInput({
        message: 'Could not extract Spotify track ID from URL',
        operation: 'addSpotifyTrackToPlaylist'
      })
    }

    const resolved = yield* identity.importProviderEntityLazy({
      entityType: 'track',
      sourceUrl: spotifyUrl,
      origin: 'spotify_import',
      loadSnapshot: Effect.suspend(() => spotify.getTrackForImport(id)).pipe(
        Effect.map(spotifyTrackSnapshot)
      )
    })
    const track = { trackId: resolved.entity.id, created: resolved.created }

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
  spotify: Pick<SpotifyService, 'getPlaylistForImport'>,
  identity: CanonicalMusicIdentityService,
  s3: MusicArtworkStore,
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
      return yield* new MusicProviderInvalidInput({
        message: 'Could not extract Spotify playlist ID from URL',
        operation: 'importSpotifyPlaylist'
      })
    }

    const data: SpotifyImportPlaylist = yield* spotify.getPlaylistForImport(id)
    const storedCoverImageUrl = data.coverImageUrl
      ? yield* copyMusicCoverImageBestEffort(
          s3,
          cdnUrl,
          bucketName,
          'playlist',
          id,
          data.coverImageUrl
        )
      : null
    const resolvedPlaylist = yield* identity.importProviderEntity({
      snapshot: {
        entityType: 'playlist',
        sourceUrl: data.playlistUrl,
        title: data.title,
        imageUrl: storedCoverImageUrl ?? data.coverImageUrl ?? undefined,
        description: data.description ?? undefined,
        curatorId,
        sourceMetadata: { spotifyPlaylistId: data.spotifyPlaylistId }
      },
      origin: 'spotify_import'
    })
    const playlistId = resolvedPlaylist.entity.id
    const playlistRows = yield* Effect.tryPromise({
      try: () =>
        db
          .select()
          .from(musicPlaylistsTable)
          .where(eq(musicPlaylistsTable.id, playlistId))
          .limit(1),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to load imported playlist: ${getErrorMessage(error)}`,
          operation: 'select',
          table: 'music_playlists'
        })
    })
    const playlist = playlistRows[0]
    if (!playlist) {
      return yield* new DatabaseError({
        message: 'Imported Spotify playlist was not persisted',
        operation: 'select',
        table: 'music_playlists'
      })
    }
    const tracks = yield* Effect.forEach(data.tracks, (track) =>
      identity
        .importProviderEntity({ snapshot: spotifyTrackSnapshot(track), origin: 'spotify_import' })
        .pipe(
          Effect.map((resolved) => ({ trackId: resolved.entity.id, created: resolved.created }))
        )
    )
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
                coverImageUrl: storedCoverImageUrl ?? current.coverImageUrl ?? data.coverImageUrl,
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
                      artistNames: track.artistNames,
                      created: resolved.created
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
        identity,
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
  identity: CanonicalMusicIdentityService,
  s3: MusicArtworkStore,
  cdnUrl: string,
  bucketName: string
) =>
  Effect.fn('musicEntity.syncPlaylistLinks')(function* (playlistId: string) {
    const db = yield* Database
    const refreshedPlaylist = yield* identity.refreshEntity({
      entityType: 'playlist',
      entityId: playlistId,
      actorId: 'playlist_sync'
    })
    if (refreshedPlaylist.artworkUrl) {
      const publicCoverImageUrl = yield* copyMusicCoverImageBestEffort(
        s3,
        cdnUrl,
        bucketName,
        'playlist',
        playlistId,
        refreshedPlaylist.artworkUrl
      )
      if (publicCoverImageUrl && publicCoverImageUrl !== refreshedPlaylist.artworkUrl) {
        yield* Effect.tryPromise({
          try: () =>
            db
              .update(musicPlaylistsTable)
              .set({ coverImageUrl: publicCoverImageUrl, updatedAt: new Date() })
              .where(eq(musicPlaylistsTable.id, playlistId)),
          catch: (error) =>
            new DatabaseError({
              message: `Failed to update playlist cover image: ${getErrorMessage(error)}`,
              operation: 'update',
              table: 'music_playlists'
            })
        })
      }
    }

    const targets = yield* getPlaylistLinkSyncTargetsEffect(playlistId)

    if (targets.length === 0) return { playlistId, queuedTrackCount: 0 }

    yield* Effect.logInfo('[MusicEntity] Scheduling manual playlist link sync', {
      playlistId,
      trackCount: targets.length
    })

    yield* enrichImportedPlaylistLinksEffect(
      identity,
      s3,
      cdnUrl,
      bucketName,
      playlistId,
      targets
    ).pipe(Effect.forkDetach)

    return { playlistId, queuedTrackCount: targets.length }
  })
