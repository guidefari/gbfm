import { SpotifyApi as SpotifyApiClient } from '@spotify/web-api-ts-sdk'
import { Effect } from 'effect'
import * as HttpStatusCodes from 'stoker/http-status-codes'
import { env } from '@/env'
import type { AppRouteHandler } from '@/lib/types'
import type {
  EnrichTrackFromUrlRoute,
  GetAlbumRoute,
  GetPlaylistRoute,
  GetTrackRoute,
  SearchAlbumsRoute
} from './spotify.routes'
import * as SpotifyTypes from './spotify.types'

const client = SpotifyApiClient.withClientCredentials(
  env.SPOTIFY_CLIENT_ID,
  env.SPOTIFY_CLIENT_SECRET
)

function cleanId(id: string): string | null {
  let ideez: string

  try {
    const decodedUrl = decodeURIComponent(id)
    !!new URL(decodedUrl)
    ideez = decodedUrl
  } catch (_error) {
    return id
  }

  return getIdFromSpotifyUrl(ideez)
}

const getIdFromSpotifyUrl = (url: string): string | null => {
  const regex = /\/(\w+)\?/
  const match = url.match(regex)
  if (match?.[1]) {
    return match[1]
  }
  return null
}

export const getTrack: AppRouteHandler<GetTrackRoute> = async (c) => {
  try {
    const { id } = c.req.valid('json')
    const sanitizedId = cleanId(id)

    if (!id || !sanitizedId) {
      return c.json({ error: 'Invalid Id passed' }, HttpStatusCodes.NOT_FOUND)
    }

    const data = await client.tracks.get(sanitizedId)

    const sanitizedData: SpotifyTypes.Track = {
      albumType: data.album?.album_type,
      albumImageUrl: data.album?.images[0]?.url,
      title: data.name,
      artists: data.artists.map((artist) => artist.name).join(', '),
      trackUrl: data.external_urls.spotify,
      previewUrl: data.preview_url ?? undefined
    }

    const result = SpotifyTypes.TrackSchema.parse(sanitizedData)
    return c.json(result, HttpStatusCodes.OK)
  } catch (error) {
    if (error instanceof Error) {
      return c.json({ error: error.message }, HttpStatusCodes.NOT_FOUND)
    }
    return c.json(
      { error: 'An unknown error occurred' },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    )
  }
}

export const getAlbum: AppRouteHandler<GetAlbumRoute> = async (c) => {
  try {
    const { id } = c.req.valid('json')
    const sanitizedId = cleanId(id)

    if (!id || !sanitizedId) {
      return c.json({ error: 'Invalid Id passed' }, HttpStatusCodes.NOT_FOUND)
    }

    const data = await client.albums.get(sanitizedId)

    const sanitizedData: SpotifyTypes.Album = {
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

    const result = SpotifyTypes.AlbumSchema.parse(sanitizedData)
    return c.json(result, HttpStatusCodes.OK)
  } catch (error) {
    if (error instanceof Error) {
      return c.json({ error: error.message }, HttpStatusCodes.NOT_FOUND)
    }
    return c.json(
      { error: 'An unknown error occurred' },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    )
  }
}

export const getPlaylist: AppRouteHandler<GetPlaylistRoute> = async (c) => {
  try {
    const { id } = c.req.valid('json')
    const sanitizedId = cleanId(id)

    if (!id || !sanitizedId) {
      return c.json({ error: 'Invalid Id passed' }, HttpStatusCodes.NOT_FOUND)
    }

    const data = await client.playlists.getPlaylist(sanitizedId)

    const sanitizedData: SpotifyTypes.Playlist = {
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

    const result = SpotifyTypes.PlaylistSchema.parse(sanitizedData)
    return c.json(result, HttpStatusCodes.OK)
  } catch (error) {
    if (error instanceof Error) {
      return c.json({ error: error.message }, HttpStatusCodes.NOT_FOUND)
    }
    return c.json(
      { error: 'An unknown error occurred' },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    )
  }
}

export const searchAlbums: AppRouteHandler<SearchAlbumsRoute> = async (c) => {
  try {
    const { query, limit = 10, offset = 0 } = c.req.valid('json')

    if (!query || query.trim() === '') {
      return c.json(
        { error: 'Search query is required' },
        HttpStatusCodes.BAD_REQUEST
      )
    }

    const validatedLimit = Math.min(Math.max(1, limit), 50) as Parameters<
      typeof client.search
    >[3]

    const data = await client.search(
      query,
      ['album', 'track'],
      undefined,
      validatedLimit,
      offset
    )

    if (!data.albums) {
      return c.json(
        {
          albums: [],
          total: 0,
          limit,
          offset
        },
        HttpStatusCodes.OK
      )
    }

    const sanitizedData: SpotifyTypes.SearchAlbumsResponse = {
      albums: data.albums.items.map((album) => ({
        id: album.id,
        title: album.name,
        artists: album.artists.map((artist) => artist.name).join(', '),
        albumType: album.album_type,
        releaseDate: album.release_date,
        albumImageUrl: album.images[0]?.url,
        albumUrl: album.external_urls.spotify,
        totalTracks: album.total_tracks
      })),
      total: data.albums.total,
      limit: data.albums.limit,
      offset: data.albums.offset
    }

    const result = SpotifyTypes.SearchAlbumsResponseSchema.parse(sanitizedData)
    return c.json(result, HttpStatusCodes.OK)
  } catch (error) {
    if (error instanceof Error) {
      return c.json(
        { error: error.message },
        HttpStatusCodes.INTERNAL_SERVER_ERROR
      )
    }
    return c.json(
      { error: 'An unknown error occurred' },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    )
  }
}

// Platform detection and URL parsing utilities
const isSpotifyUrl = (url: string): boolean => {
  return url.includes('spotify.com') || url.includes('spotify.link')
}

const isYouTubeUrl = (url: string): boolean => {
  return url.includes('youtube.com') || url.includes('youtu.be')
}

const isAppleMusicUrl = (url: string): boolean => {
  return url.includes('music.apple.com')
}

const extractSpotifyId = (url: string): string | null => {
  // Handle various Spotify URL formats
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

const extractYouTubeId = (url: string): string | null => {
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

// Effect-based enrichment functions
const enrichSpotifyTrack = (trackId: string) =>
  Effect.gen(function* () {
    try {
      const data = yield* Effect.tryPromise({
        try: () => client.tracks.get(trackId),
        catch: (error) => error as Error
      })

      if (data instanceof Error) {
        return yield* Effect.fail(data)
      }

      return {
        title: data.name,
        artist: data.artists.map((artist) => artist.name).join(', '),
        url: data.external_urls.spotify,
        platform: 'spotify' as const,
        thumbnailUrl: data.album.images[0]?.url,
        album: data.album.name,
        duration: Math.floor(data.duration_ms / 1000) // Convert to seconds
      }
    } catch (error) {
      return yield* Effect.fail(error as Error)
    }
  })

const enrichYouTubeTrack = (videoId: string) =>
  Effect.gen(function* () {
    // For YouTube, we'll do basic parsing since we don't have an API key
    // In a real implementation, you'd use the YouTube Data API
    return yield* Effect.succeed({
      title: 'YouTube Video',
      artist: 'Unknown Artist',
      url: `https://www.youtube.com/watch?v=${videoId}`,
      platform: 'youtube' as const,
      thumbnailUrl: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`
    })
  })

const enrichAppleMusicTrack = (url: string) =>
  Effect.gen(function* () {
    // For Apple Music, we'll do basic parsing
    // In a real implementation, you'd use the Apple Music API
    return yield* Effect.succeed({
      title: 'Apple Music Track',
      artist: 'Unknown Artist',
      url: url,
      platform: 'apple_music' as const
    })
  })

const enrichGenericUrl = (url: string) =>
  Effect.gen(function* () {
    // For unsupported platforms, return basic info
    return yield* Effect.succeed({
      title: 'External Track',
      artist: 'Unknown Artist',
      url: url,
      platform: 'other' as const
    })
  })

export const enrichTrackFromUrl: AppRouteHandler<
  EnrichTrackFromUrlRoute
> = async (c) => {
  const enrichTrack = Effect.gen(function* () {
    const { url } = c.req.valid('json')

    let enrichmentResult: {
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
        return yield* Effect.fail(new Error('Invalid Spotify URL'))
      }
      enrichmentResult = yield* enrichSpotifyTrack(trackId)
    } else if (isYouTubeUrl(url)) {
      const videoId = extractYouTubeId(url)
      if (!videoId) {
        return yield* Effect.fail(new Error('Invalid YouTube URL'))
      }
      enrichmentResult = yield* enrichYouTubeTrack(videoId)
    } else if (isAppleMusicUrl(url)) {
      enrichmentResult = yield* enrichAppleMusicTrack(url)
    } else {
      enrichmentResult = yield* enrichGenericUrl(url)
    }

    return enrichmentResult
  })

  try {
    const result = await Effect.runPromise(enrichTrack)

    return c.json(result, HttpStatusCodes.OK)
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('Invalid') || error.message.includes('URL')) {
        return c.json({ error: error.message }, HttpStatusCodes.BAD_REQUEST)
      }
      return c.json(
        { error: 'Track not found or access denied' },
        HttpStatusCodes.NOT_FOUND
      )
    }
    return c.json(
      { error: 'Failed to enrich track details' },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    )
  }
}
