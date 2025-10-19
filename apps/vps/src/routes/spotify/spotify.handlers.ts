import { SpotifyApi as SpotifyApiClient } from '@spotify/web-api-ts-sdk'
import * as HttpStatusCodes from 'stoker/http-status-codes'
import { env } from '@/env'
import type { AppRouteHandler } from '@/lib/types'
import type {
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
