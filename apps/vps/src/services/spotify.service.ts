import { SpotifyApi as SpotifyApiClient } from '@spotify/web-api-ts-sdk'
import { Context, Effect, Layer } from 'effect'
import { env } from '@/env'
import { SpotifyError } from '@/errors'
import type {
  Album,
  Playlist,
  SearchAlbumsResponse,
  Track
} from '../routes/spotify/spotify.types'

// Service interface
export interface SpotifyService {
  readonly getTrack: (id: string) => Effect.Effect<Track, SpotifyError>
  readonly getAlbum: (id: string) => Effect.Effect<Album, SpotifyError>
  readonly getPlaylist: (id: string) => Effect.Effect<Playlist, SpotifyError>
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
      platform: 'spotify' | 'youtube' | 'apple_music' | 'other'
      thumbnailUrl?: string
      album?: string
      duration?: number
    },
    SpotifyError
  >
}

// Service tag for dependency injection
export const SpotifyService =
  Context.GenericTag<SpotifyService>('SpotifyService')

// Spotify client instance
const spotifyClient = SpotifyApiClient.withClientCredentials(
  env.SPOTIFY_CLIENT_ID,
  env.SPOTIFY_CLIENT_SECRET
)

export const getIdFromSpotifyUrl = (url: string): string | null => {
  const regex = /\/(\w+)\?/
  const match = url.match(regex)
  return match?.[1] || null
}

export const cleanId = (id: string): string | null => {
  try {
    const decodedUrl = decodeURIComponent(id)
    new URL(decodedUrl)
    return getIdFromSpotifyUrl(decodedUrl)
  } catch (_error) {
    return id
  }
}

export const isSpotifyUrl = (url: string): boolean =>
  url.includes('spotify.com') || url.includes('spotify.link')

export const isYouTubeUrl = (url: string): boolean =>
  url.includes('youtube.com') || url.includes('youtu.be')

export const isAppleMusicUrl = (url: string): boolean =>
  url.includes('music.apple.com')

export const extractSpotifyId = (url: string): string | null => {
  const patterns = [
    /spotify\.com\/track\/([a-zA-Z0-9]+)/,
    /spotify\.com\/album\/([a-zA-Z0-9]+)/,
    /spotify\.com\/playlist\/([a-zA-Z0-9]+)/,
    /spotify\.link\/([a-zA-Z0-9]+)/
  ]

  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match?.[1]) {
      return match[1]
    }
  }

  return null
}

export const extractYouTubeId = (url: string): string | null => {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]+)/
  ]

  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match?.[1]) {
      return match[1]
    }
  }

  return null
}

// Core service logic - pure Effects with no service dependencies
const getTrackEffect = (id: string) =>
  Effect.gen(function* () {
    const sanitizedId = cleanId(id)

    if (!id || !sanitizedId) {
      return yield* Effect.fail(
        new SpotifyError({
          message: 'Invalid track ID provided',
          operation: 'getTrack',
          statusCode: 400
        })
      )
    }

    const data = yield* Effect.tryPromise({
      try: () => spotifyClient.tracks.get(sanitizedId),
      catch: (error) =>
        new SpotifyError({
          message: `Failed to fetch track: ${(error as Error).message}`,
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
      return yield* Effect.fail(
        new SpotifyError({
          message: 'Invalid album ID provided',
          operation: 'getAlbum',
          statusCode: 400
        })
      )
    }

    const data = yield* Effect.tryPromise({
      try: () => spotifyClient.albums.get(sanitizedId),
      catch: (error) =>
        new SpotifyError({
          message: `Failed to fetch album: ${(error as Error).message}`,
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
      return yield* Effect.fail(
        new SpotifyError({
          message: 'Invalid playlist ID provided',
          operation: 'getPlaylist',
          statusCode: 400
        })
      )
    }

    const data = yield* Effect.tryPromise({
      try: () => spotifyClient.playlists.getPlaylist(sanitizedId),
      catch: (error) =>
        new SpotifyError({
          message: `Failed to fetch playlist: ${(error as Error).message}`,
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

const searchAlbumsEffect = (query: string, limit = 10, offset = 0) =>
  Effect.gen(function* () {
    if (!query || query.trim() === '') {
      return yield* Effect.fail(
        new SpotifyError({
          message: 'Search query is required',
          operation: 'searchAlbums',
          statusCode: 400
        })
      )
    }

    const validatedLimit = Math.min(Math.max(1, limit), 50) as Parameters<
      typeof spotifyClient.search
    >[3]

    const data = yield* Effect.tryPromise({
      try: () =>
        spotifyClient.search(
          query,
          ['album'],
          undefined,
          validatedLimit,
          offset
        ),
      catch: (error) =>
        new SpotifyError({
          message: `Failed to search albums: ${(error as Error).message}`,
          operation: 'searchAlbums',
          statusCode: 500
        })
    })

    const searchResponse: SearchAlbumsResponse = {
      albums: (data.albums?.items || []).map((album) => ({
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
      limit: data.albums?.limit ?? validatedLimit,
      offset: data.albums?.offset ?? offset
    }

    return searchResponse
  })

const enrichTrackFromUrlEffect = (url: string) =>
  Effect.gen(function* () {
    let result: {
      title: string
      artist: string
      url: string
      platform: 'spotify' | 'youtube' | 'apple_music' | 'other'
      thumbnailUrl?: string
      album?: string
      duration?: number
    }

    if (isSpotifyUrl(url)) {
      const trackId = extractSpotifyId(url)
      if (!trackId) {
        return yield* Effect.fail(
          new SpotifyError({
            message: 'Invalid Spotify URL',
            operation: 'enrichTrackFromUrl',
            statusCode: 400
          })
        )
      }

      const data = yield* Effect.tryPromise({
        try: () => spotifyClient.tracks.get(trackId),
        catch: (error) =>
          new SpotifyError({
            message: `Failed to fetch Spotify track: ${(error as Error).message}`,
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
    } else if (isYouTubeUrl(url)) {
      const videoId = extractYouTubeId(url)
      if (!videoId) {
        return yield* Effect.fail(
          new SpotifyError({
            message: 'Invalid YouTube URL',
            operation: 'enrichTrackFromUrl',
            statusCode: 400
          })
        )
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

// Implementation - simple layer that provides access to the Effects
export const SpotifyServiceLive = Layer.succeed(SpotifyService, {
  getTrack: getTrackEffect,
  getAlbum: getAlbumEffect,
  getPlaylist: getPlaylistEffect,
  searchAlbums: searchAlbumsEffect,
  enrichTrackFromUrl: enrichTrackFromUrlEffect
})
