import { SpotifyApi as SpotifyApiClient } from '@spotify/web-api-ts-sdk'
import { Context, Effect, Layer } from 'effect'
import { getErrorMessage, SpotifyError } from '@/errors'
import {
  calculateBandcampTotalDuration,
  extractBandcampArtist,
  getBandcampMetadataWithSpan
} from '@/services/bandcamp.service'
import { config } from '@/services/config.service'
import {
  cleanId,
  extractSpotifyId,
  extractYouTubeId,
  isAppleMusicUrl,
  isBandcampUrl,
  isSpotifyUrl,
  isYouTubeUrl
} from '@/services/url-utils'
import type { Album, Playlist, SearchAlbumsResponse, Track } from '../routes/spotify/spotify.types'

const SPOTIFY_SEARCH_API_LIMIT = 50

export {
  cleanId,
  extractBandcampId,
  extractSpotifyId,
  extractYouTubeId,
  getIdFromSpotifyUrl,
  isAppleMusicUrl,
  isBandcampUrl,
  isSpotifyUrl,
  isYouTubeUrl
} from '@/services/url-utils'

export interface SpotifyImportTrack {
  spotifyTrackId: string
  title: string
  artistNames: string[]
  artistSpotifyIds: string[]
  albumName: string | null
  albumSpotifyId: string | null
  albumImageUrl: string | null
  trackUrl: string
  previewUrl: string | null
  durationMs: number | null
  trackNumber: number | null
}

export interface SpotifyImportPlaylist {
  spotifyPlaylistId: string
  title: string
  description: string | null
  coverImageUrl: string | null
  ownerName: string | null
  playlistUrl: string
  tracks: SpotifyImportTrack[]
}

export interface SpotifyService {
  readonly getTrack: (id: string) => Effect.Effect<Track, SpotifyError>
  readonly getAlbum: (id: string) => Effect.Effect<Album, SpotifyError>
  readonly getPlaylist: (id: string) => Effect.Effect<Playlist, SpotifyError>
  readonly getPlaylistForImport: (id: string) => Effect.Effect<SpotifyImportPlaylist, SpotifyError>
  readonly getTrackForImport: (id: string) => Effect.Effect<SpotifyImportTrack, SpotifyError>
  readonly searchAlbums: (
    query: string,
    limit?: number,
    offset?: number
  ) => Effect.Effect<SearchAlbumsResponse, SpotifyError>
  readonly enrichTrackFromUrl: (url: string) => Effect.Effect<
    {
      title: string
      artist: string
      url: string
      platform: 'spotify' | 'youtube' | 'apple_music' | 'bandcamp' | 'other'
      thumbnailUrl?: string
      album?: string
      duration?: number
    },
    SpotifyError
  >
}

export const SpotifyService = Context.Service<SpotifyService>('SpotifyService')

const spotifyClient = SpotifyApiClient.withClientCredentials(
  config.spotify.clientId,
  config.spotify.clientSecret
)

const getTrackEffect = (id: string) =>
  Effect.gen(function* () {
    const sanitizedId = cleanId(id)

    if (!id || !sanitizedId) {
      return yield* new SpotifyError({
        message: 'Invalid track ID provided',
        operation: 'getTrack',
        statusCode: 400
      })
    }

    const data = yield* Effect.tryPromise({
      try: () => spotifyClient.tracks.get(sanitizedId),
      catch: (error) =>
        new SpotifyError({
          message: `Failed to fetch track: ${getErrorMessage(error)}`,
          operation: 'getTrack',
          statusCode: 500
        })
    })

    const track: Track = {
      albumType: data.album?.album_type,
      albumImageUrl: data.album?.images[0]?.url,
      title: data.name,
      artists: data.artists.map((artist) => artist.name).join(', '),
      trackUrl: data.external_urls.spotify,
      previewUrl: data.preview_url ?? undefined
    }

    return track
  })

const getAlbumEffect = (id: string) =>
  Effect.gen(function* () {
    const sanitizedId = cleanId(id)

    if (!id || !sanitizedId) {
      return yield* new SpotifyError({
        message: 'Invalid album ID provided',
        operation: 'getAlbum',
        statusCode: 400
      })
    }

    const data = yield* Effect.tryPromise({
      try: () => spotifyClient.albums.get(sanitizedId),
      catch: (error) =>
        new SpotifyError({
          message: `Failed to fetch album: ${getErrorMessage(error)}`,
          operation: 'getAlbum',
          statusCode: 500
        })
    })

    const album: Album = {
      albumType: data.album_type,
      albumImageUrl: data.images[0]?.url,
      title: data.name,
      artists: data.artists.map((artist) => artist.name).join(', '),
      tracks: data.tracks.items.map((track) => ({
        title: track.name,
        artists: track.artists.map((artist) => artist.name).join(', '),
        previewUrl: track.preview_url ?? undefined,
        trackUrl: track.external_urls.spotify
      })),
      albumUrl: data.external_urls.spotify
    }

    return album
  })

const getPlaylistEffect = (id: string) =>
  Effect.gen(function* () {
    const sanitizedId = cleanId(id)

    if (!id || !sanitizedId) {
      return yield* new SpotifyError({
        message: 'Invalid playlist ID provided',
        operation: 'getPlaylist',
        statusCode: 400
      })
    }

    const data = yield* Effect.tryPromise({
      try: () => spotifyClient.playlists.getPlaylist(sanitizedId),
      catch: (error) =>
        new SpotifyError({
          message: `Failed to fetch playlist: ${getErrorMessage(error)}`,
          operation: 'getPlaylist',
          statusCode: 500
        })
    })

    const playlist: Playlist = {
      coverImageUrl: data.images[0]?.url,
      title: data.name,
      description: data.description,
      tracks: data.tracks.items.map(({ track }) => ({
        title: track.name,
        artists: track.artists.map((artist) => artist.name).join(', '),
        previewUrl: track.preview_url ?? undefined,
        trackUrl: track.external_urls.spotify
      })),
      ownerName: data.owner.display_name,
      playlistUrl: data.external_urls.spotify
    }

    return playlist
  })

const PLAYLIST_IMPORT_CACHE_TTL_MS = 60 * 60 * 1000
const playlistImportCache = new Map<string, { value: SpotifyImportPlaylist; expiresAt: number }>()

const getPlaylistForImportEffect = (id: string) =>
  Effect.gen(function* () {
    const sanitizedId = cleanId(id)

    if (!id || !sanitizedId) {
      return yield* new SpotifyError({
        message: 'Invalid playlist ID provided',
        operation: 'getPlaylistForImport',
        statusCode: 400
      })
    }

    const now = Date.now()
    const cached = playlistImportCache.get(sanitizedId)
    if (cached && cached.expiresAt > now) {
      return cached.value
    }

    const data = yield* Effect.tryPromise({
      try: () => spotifyClient.playlists.getPlaylist(sanitizedId),
      catch: (error) =>
        new SpotifyError({
          message: `Failed to fetch playlist: ${getErrorMessage(error)}`,
          operation: 'getPlaylistForImport',
          statusCode: 500
        })
    })

    const tracks: SpotifyImportTrack[] = data.tracks.items
      .filter((item) => item.track?.id)
      .map(({ track }) => ({
        spotifyTrackId: track.id,
        title: track.name,
        artistNames: track.artists.map((a) => a.name),
        artistSpotifyIds: track.artists.map((a) => a.id).filter(Boolean),
        albumName: track.album?.name ?? null,
        albumSpotifyId: track.album?.id ?? null,
        albumImageUrl: track.album?.images?.[0]?.url ?? null,
        trackUrl: track.external_urls.spotify,
        previewUrl: track.preview_url ?? null,
        durationMs: track.duration_ms ?? null,
        trackNumber: track.track_number ?? null
      }))

    const result: SpotifyImportPlaylist = {
      spotifyPlaylistId: data.id,
      title: data.name,
      description: data.description ?? null,
      coverImageUrl: data.images?.[0]?.url ?? null,
      ownerName: data.owner.display_name ?? null,
      playlistUrl: data.external_urls.spotify,
      tracks
    }

    playlistImportCache.set(sanitizedId, {
      value: result,
      expiresAt: now + PLAYLIST_IMPORT_CACHE_TTL_MS
    })

    return result
  })

const searchAlbumsEffect = (query: string, limit = 10, offset = 0) =>
  Effect.gen(function* () {
    if (!query || query.trim() === '') {
      return yield* new SpotifyError({
        message: 'Search query is required',
        operation: 'searchAlbums',
        statusCode: 400
      })
    }

    const validatedLimit = Math.min(Math.max(1, limit), SPOTIFY_SEARCH_API_LIMIT)

    const data = yield* Effect.tryPromise({
      try: () =>
        spotifyClient.search(query, ['album'], undefined, SPOTIFY_SEARCH_API_LIMIT, offset),
      catch: (error) =>
        new SpotifyError({
          message: `Failed to search albums: ${getErrorMessage(error)}`,
          operation: 'searchAlbums',
          statusCode: 500
        })
    })

    const searchResponse: SearchAlbumsResponse = {
      albums: (data.albums?.items || []).slice(0, validatedLimit).map((album) => ({
        id: album.id,
        title: album.name,
        artists: album.artists.map((artist) => artist.name).join(', '),
        albumType: album.album_type,
        releaseDate: album.release_date,
        albumImageUrl: album.images[0]?.url,
        albumUrl: album.external_urls.spotify,
        totalTracks: album.total_tracks
      })),
      total: data.albums?.total || 0,
      limit: validatedLimit,
      offset: data.albums?.offset ?? offset
    }

    return searchResponse
  })

const getTrackWithSpan = (id: string) =>
  getTrackEffect(id).pipe(
    Effect.withSpan('spotify.getTrack', {
      attributes: { 'spotify.id': id, 'external.system': 'spotify' }
    })
  )

const getAlbumWithSpan = (id: string) =>
  getAlbumEffect(id).pipe(
    Effect.withSpan('spotify.getAlbum', {
      attributes: { 'spotify.id': id, 'external.system': 'spotify' }
    })
  )

const getPlaylistWithSpan = (id: string) =>
  getPlaylistEffect(id).pipe(
    Effect.withSpan('spotify.getPlaylist', {
      attributes: { 'spotify.id': id, 'external.system': 'spotify' }
    })
  )

const getTrackForImportEffect = (id: string) =>
  Effect.gen(function* () {
    const sanitizedId = cleanId(id)
    if (!id || !sanitizedId) {
      return yield* new SpotifyError({
        message: 'Invalid track ID provided',
        operation: 'getTrackForImport',
        statusCode: 400
      })
    }

    const data = yield* Effect.tryPromise({
      try: () => spotifyClient.tracks.get(sanitizedId),
      catch: (error) =>
        new SpotifyError({
          message: `Failed to fetch track: ${getErrorMessage(error)}`,
          operation: 'getTrackForImport',
          statusCode: 500
        })
    })

    const result: SpotifyImportTrack = {
      spotifyTrackId: data.id,
      title: data.name,
      artistNames: data.artists.map((a) => a.name),
      artistSpotifyIds: data.artists.map((a) => a.id).filter(Boolean),
      albumName: data.album?.name ?? null,
      albumSpotifyId: data.album?.id ?? null,
      albumImageUrl: data.album?.images?.[0]?.url ?? null,
      trackUrl: data.external_urls.spotify,
      previewUrl: data.preview_url ?? null,
      durationMs: data.duration_ms ?? null,
      trackNumber: data.track_number ?? null
    }

    return result
  })

const getTrackForImportWithSpan = (id: string) =>
  getTrackForImportEffect(id).pipe(
    Effect.withSpan('spotify.getTrackForImport', {
      attributes: { 'spotify.id': id, 'external.system': 'spotify' }
    })
  )

const getPlaylistForImportWithSpan = (id: string) =>
  getPlaylistForImportEffect(id).pipe(
    Effect.withSpan('spotify.getPlaylistForImport', {
      attributes: { 'spotify.id': id, 'external.system': 'spotify' }
    })
  )

const searchAlbumsWithSpan = (query: string, limit = 10, offset = 0) =>
  searchAlbumsEffect(query, limit, offset).pipe(
    Effect.withSpan('spotify.searchAlbums', {
      attributes: {
        'spotify.query_length': query.length,
        'spotify.limit': limit,
        'spotify.offset': offset,
        'external.system': 'spotify'
      }
    })
  )

const enrichTrackFromUrlWithSpan = Effect.fn('spotify.enrichTrackFromUrl')(function* (url: string) {
  const platform = isSpotifyUrl(url)
    ? 'spotify'
    : isYouTubeUrl(url)
      ? 'youtube'
      : isAppleMusicUrl(url)
        ? 'apple_music'
        : isBandcampUrl(url)
          ? 'bandcamp'
          : 'other'

  yield* Effect.annotateCurrentSpan('music.platform', platform)

  let result: {
    title: string
    artist: string
    url: string
    platform: 'spotify' | 'youtube' | 'apple_music' | 'bandcamp' | 'other'
    thumbnailUrl?: string
    album?: string
    duration?: number
  }

  if (isSpotifyUrl(url)) {
    const id = extractSpotifyId(url)
    if (!id) {
      return yield* new SpotifyError({
        message: 'Invalid Spotify URL',
        operation: 'enrichTrackFromUrl',
        statusCode: 400
      })
    }

    yield* Effect.annotateCurrentSpan('spotify.id', id)
    yield* Effect.annotateCurrentSpan('url.type', url.includes('/album/') ? 'album' : 'track')

    if (url.includes('/album/')) {
      const data = yield* Effect.tryPromise({
        try: () => spotifyClient.albums.get(id),
        catch: (error) =>
          new SpotifyError({
            message: `Failed to fetch Spotify album: ${getErrorMessage(error)}`,
            operation: 'enrichTrackFromUrl',
            statusCode: 500
          })
      })

      result = {
        title: data.name,
        artist: data.artists.map((artist) => artist.name).join(', '),
        url: data.external_urls.spotify,
        platform: 'spotify',
        thumbnailUrl: data.images[0]?.url,
        album: data.name,
        duration: data.tracks.items.reduce((total, track) => total + track.duration_ms, 0) / 1000
      }
    } else {
      const data = yield* Effect.tryPromise({
        try: () => spotifyClient.tracks.get(id),
        catch: (error) =>
          new SpotifyError({
            message: `Failed to fetch Spotify track: ${getErrorMessage(error)}`,
            operation: 'enrichTrackFromUrl',
            statusCode: 500
          })
      })

      result = {
        title: data.name,
        artist: data.artists.map((artist) => artist.name).join(', '),
        url: data.external_urls.spotify,
        platform: 'spotify',
        thumbnailUrl: data.album.images[0]?.url,
        album: data.album.name,
        duration: Math.floor(data.duration_ms / 1000)
      }
    }
  } else if (isYouTubeUrl(url)) {
    const videoId = extractYouTubeId(url)
    if (!videoId) {
      return yield* new SpotifyError({
        message: 'Invalid YouTube URL',
        operation: 'enrichTrackFromUrl',
        statusCode: 400
      })
    }

    result = {
      title: 'YouTube Video',
      artist: 'Unknown Artist',
      url: `https://www.youtube.com/watch?v=${videoId}`,
      platform: 'youtube',
      thumbnailUrl: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`
    }
  } else if (isAppleMusicUrl(url)) {
    result = {
      title: 'Apple Music Track',
      artist: 'Unknown Artist',
      url: url,
      platform: 'apple_music'
    }
  } else if (isBandcampUrl(url)) {
    const metadata = yield* getBandcampMetadataWithSpan(url)

    result = {
      title: metadata.name,
      artist: extractBandcampArtist(metadata),
      url: url,
      platform: 'bandcamp',
      thumbnailUrl: metadata.image,
      album: metadata.name,
      duration: calculateBandcampTotalDuration(metadata)
    }
  } else {
    result = {
      title: 'External Track',
      artist: 'Unknown Artist',
      url: url,
      platform: 'other'
    }
  }

  return result
})

export const SpotifyServiceLayer = Layer.succeed(SpotifyService, {
  getTrack: getTrackWithSpan,
  getAlbum: getAlbumWithSpan,
  getPlaylist: getPlaylistWithSpan,
  getPlaylistForImport: getPlaylistForImportWithSpan,
  getTrackForImport: getTrackForImportWithSpan,
  searchAlbums: searchAlbumsWithSpan,
  enrichTrackFromUrl: enrichTrackFromUrlWithSpan
})
