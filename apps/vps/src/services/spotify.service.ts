import { SpotifyApi as SpotifyApiClient } from '@spotify/web-api-ts-sdk'
import { Context, Effect, Layer, Option } from 'effect'
import { SpotifyError } from '@/errors'
import { config } from '@/services/config.service'
import type {
  Album,
  Playlist,
  SearchAlbumsResponse,
  Track
} from '../routes/spotify/spotify.types'

// Bandcamp metadata types
interface BandcampAlbum {
  '@type': 'MusicAlbum'
  name: string
  byArtist: { name: string } | { name: string }[]
  image: string
  datePublished: string
  track?: {
    itemListElement: Array<{
      item: {
        name: string
        duration: string
        '@id': string
      }
    }>
  }
  description?: string
}

// Simple in-memory cache for Bandcamp data
const bandcampCache = new Map<
  string,
  { data: BandcampAlbum; timestamp: number }
>()
const CACHE_DURATION = 24 * 60 * 60 * 1000 // 24 hours

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
      platform: 'spotify' | 'youtube' | 'apple_music' | 'bandcamp' | 'other'
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
  config.spotify.clientId,
  config.spotify.clientSecret
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

export const isBandcampUrl = (url: string): boolean =>
  url.includes('bandcamp.com')

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

export const extractBandcampId = (url: string): string | null => {
  const match =
    url.match(/bandcamp\.com\/album\/([^/?]+)/) ||
    url.match(/bandcamp\.com\/track\/([^/?]+)/)
  return match?.[1] || null
}

// Fallback HTML parsing for Bandcamp pages
const parseBandcampHtml = (html: string, _url: string) =>
  Effect.gen(function* () {
    const metadata: BandcampAlbum = {
      '@type': 'MusicAlbum',
      name: '',
      byArtist: { name: '' },
      image: '',
      datePublished: new Date().toISOString()
    }

    // Extract title from #name-section h2.trackTitle
    const titleMatch = html.match(
      /<div[^>]*id="name-section"[^>]*>[\s\S]*?<h2[^>]*class="trackTitle"[^>]*>([^<]+)<\/h2>/
    )
    if (titleMatch?.[1]) {
      metadata.name = titleMatch[1].trim()
    } else {
      return yield* new SpotifyError({
        message: 'Could not extract title from Bandcamp page',
        operation: 'parseBandcampHtml',
        statusCode: 500
      })
    }

    // Extract artist from #name-section h3 (text after "by ")
    const artistMatch = html.match(
      /<div[^>]*id="name-section"[^>]*>[\s\S]*?<h3[^>]*>([\s\S]*?)<\/h3>/
    )
    if (artistMatch?.[1]) {
      const artistText = artistMatch[1].replace(/<[^>]+>/g, '').trim() // Remove HTML tags
      const byMatch = artistText.match(/by\s+(.+)/i)
      if (byMatch?.[1]) {
        metadata.byArtist = { name: byMatch[1].trim() }
      }
    }

    // Extract image from a.popupImage href
    const imageMatch = html.match(
      /<a[^>]*class="popupImage"[^>]*href="([^"]+)"/
    )
    if (imageMatch?.[1]) {
      metadata.image = imageMatch[1]
    }

    // Extract release date if available (look for patterns like "released" or date formats)
    const dateMatch = html.match(
      /(?:released|release date)[^>]*(\d{1,2}\s+\w+\s+\d{4}|\w+\s+\d{1,2},?\s+\d{4}|\d{4}-\d{2}-\d{2})/i
    )
    if (dateMatch?.[1]) {
      const parsedDate = new Date(dateMatch[1])
      if (!Number.isNaN(parsedDate.getTime())) {
        metadata.datePublished = parsedDate.toISOString()
      }
    }

    return metadata
  })

// Bandcamp metadata extraction with caching
const getBandcampMetadata = (url: string) =>
  Effect.gen(function* () {
    // Check cache first
    const cacheKey = url
    const cached = bandcampCache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return cached.data
    }

    // Fetch the Bandcamp page
    const response = yield* Effect.tryPromise({
      try: () =>
        fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; MusicMetadataBot/1.0)'
          }
        }),
      catch: (error) =>
        new SpotifyError({
          message: `Failed to fetch Bandcamp page: ${(error as Error).message}`,
          operation: 'getBandcampMetadata',
          statusCode: 500
        })
    })

    if (!response.ok) {
      return yield* new SpotifyError({
        message: `Bandcamp page returned ${response.status}`,
        operation: 'getBandcampMetadata',
        statusCode: response.status
      })
    }

    const html = yield* Effect.tryPromise({
      try: () => response.text(),
      catch: (error) =>
        new SpotifyError({
          message: `Failed to read Bandcamp page content: ${(error as Error).message}`,
          operation: 'getBandcampMetadata',
          statusCode: 500
        })
    })

    let metadata: BandcampAlbum | undefined

    // Try JSON-LD structured data first
    const jsonLdMatch = html.match(
      /<script type="application\/ld\+json">([\s\S]*?)<\/script>/
    )
    if (jsonLdMatch?.[1]) {
      const parseResult = Effect.sync(() => {
        return JSON.parse(jsonLdMatch[1] || '')
      }).pipe(Effect.option)
      const parsed = yield* parseResult
      if (Option.isSome(parsed)) {
        metadata = parsed.value
      }
    }

    // If JSON-LD failed or wasn't found, parse HTML directly
    if (!metadata) {
      metadata = yield* parseBandcampHtml(html, url)
    }

    // Cache the result
    bandcampCache.set(cacheKey, { data: metadata, timestamp: Date.now() })

    return metadata
  })

// Core service logic - pure Effects with no service dependencies
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
      return yield* new SpotifyError({
        message: 'Search query is required',
        operation: 'searchAlbums',
        statusCode: 400
      })
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

      // Check if this is an album URL
      if (url.includes('/album/')) {
        const data = yield* Effect.tryPromise({
          try: () => spotifyClient.albums.get(id),
          catch: (error) =>
            new SpotifyError({
              message: `Failed to fetch Spotify album: ${(error as Error).message}`,
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
          album: data.name, // Album title is the album name
          duration:
            data.tracks.items.reduce(
              (total, track) => total + track.duration_ms,
              0
            ) / 1000 // Total duration of all tracks
        }
      } else {
        // Handle as track
        const data = yield* Effect.tryPromise({
          try: () => spotifyClient.tracks.get(id),
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
      const metadata = yield* getBandcampMetadata(url)

      // Extract artist name (handle both single artist and multiple artists)
      const artist = Array.isArray(metadata.byArtist)
        ? metadata.byArtist.map((a: { name: string }) => a.name).join(', ')
        : metadata.byArtist.name

      // Calculate total duration from tracks if available
      let totalDuration: number | undefined
      if (metadata.track?.itemListElement) {
        totalDuration = metadata.track.itemListElement.reduce(
          (total: number, track: { item: { duration: string } }) => {
            const duration = track.item.duration
            if (duration) {
              // Parse ISO 8601 duration (e.g., "P00H19M53S")
              const match = duration.match(
                /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/
              )
              if (match) {
                const hours = parseInt(match[1] || '0', 10)
                const minutes = parseInt(match[2] || '0', 10)
                const seconds = parseInt(match[3] || '0', 10)
                return total + hours * 3600 + minutes * 60 + seconds
              }
            }
            return total
          },
          0
        )
      }

      result = {
        title: metadata.name,
        artist: artist,
        url: url,
        platform: 'bandcamp',
        thumbnailUrl: metadata.image,
        album: metadata.name, // For albums, title and album are the same
        duration: totalDuration
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
