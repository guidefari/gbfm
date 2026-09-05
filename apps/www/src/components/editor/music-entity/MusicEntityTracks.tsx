import { PlaylistTrackEntry, TrackListResponse } from '@gbfm/api/music'
import { useQuery } from '@tanstack/react-query'
import { Effect, Schema } from 'effect'
import { captureException } from '@/services/analytics'
import { SpotifyEntityActions } from '@/components/spotify/SpotifyEntityActions'
import {
  apiUrl,
  fetcher,
  spotifyAlbumProxyQueryOptions,
  spotifyPlaylistProxyQueryOptions
} from '@/lib/http'
import { spotifyEntityFromUrl } from '@/lib/spotify-pkce'
import type { Track } from '@/types'

interface Props {
  readonly type: 'album' | 'playlist'
  readonly id: string
  readonly spotifyUrl?: string
  readonly showPlaybackControls: boolean
}

interface TrackRow {
  readonly key: string
  readonly title: string
  readonly artists: string
  readonly spotifyUrl?: string
}

function spotifyRows(tracks: ReadonlyArray<Track>): ReadonlyArray<TrackRow> {
  return tracks.map((track, index) => ({
    key: `${index}:${track.trackUrl ?? ''}`,
    title: track.title ?? 'Untitled track',
    artists: track.artists ?? '',
    spotifyUrl:
      track.trackUrl && spotifyEntityFromUrl(track.trackUrl)?.kind === 'track'
        ? track.trackUrl
        : undefined
  }))
}

export function MusicEntityTracks({ type, id, spotifyUrl, showPlaybackControls }: Props) {
  const spotifyEntity = spotifyUrl ? spotifyEntityFromUrl(spotifyUrl) : null
  const hasSpotify = spotifyEntity?.kind === type
  const spotifyId = spotifyEntity?.id ?? ''
  const album = useQuery({
    ...spotifyAlbumProxyQueryOptions(spotifyId),
    enabled: hasSpotify && type === 'album',
    retry: false
  })
  const playlist = useQuery({
    ...spotifyPlaylistProxyQueryOptions(spotifyId),
    enabled: hasSpotify && type === 'playlist',
    retry: false
  })
  const spotify = type === 'album' ? album : playlist
  const useCatalog =
    !hasSpotify || spotify.isError || (spotify.isSuccess && spotify.data.tracks.length === 0)

  const catalogAlbum = useQuery({
    queryKey: ['music-entity-catalog-tracks'],
    queryFn: async () => {
      const response = await fetcher<unknown>(apiUrl('/music/tracks'))
      return Effect.runPromise(
        Schema.decodeUnknownEffect(TrackListResponse)(response).pipe(
          Effect.tapError((error) => captureException(error, { endpoint: 'music.listTracks' }))
        )
      )
    },
    staleTime: 5 * 60 * 1000,
    enabled: useCatalog && type === 'album',
    retry: false
  })
  const catalogPlaylist = useQuery({
    queryKey: ['music-entity-playlist-tracks', id],
    queryFn: async () => {
      const response = await fetcher<unknown>(apiUrl(`/music/playlists/${id}/tracks`))
      return Effect.runPromise(
        Schema.decodeUnknownEffect(Schema.Array(PlaylistTrackEntry))(response).pipe(
          Effect.tapError((error) =>
            captureException(error, { endpoint: 'music.getPlaylistTracks', entityId: id })
          )
        )
      )
    },
    staleTime: 5 * 60 * 1000,
    enabled: useCatalog && type === 'playlist',
    retry: false
  })

  const catalog = type === 'album' ? catalogAlbum : catalogPlaylist
  const catalogTracks =
    type === 'album'
      ? (catalogAlbum.data ?? [])
          .filter((track) => track.albumId === id)
          .toSorted((a, b) => (a.trackNumber ?? Infinity) - (b.trackNumber ?? Infinity))
      : (catalogPlaylist.data ?? [])
          .toSorted((a, b) => a.position - b.position)
          .map((entry) => entry.track)
  const tracks: ReadonlyArray<TrackRow> =
    hasSpotify && spotify.data?.tracks.length
      ? spotifyRows(spotify.data.tracks)
      : catalogTracks.map((track, index) => ({
          key: `${index}:${track.id}`,
          title: track.title,
          artists: track.artistNames?.join(', ') ?? ''
        }))
  const loading = useCatalog ? catalog.isPending : spotify.isPending

  if (loading) {
    return (
      <p
        role='status'
        className='border-t border-border/40 px-4 py-5 text-sm text-muted-foreground'>
        Loading tracks…
      </p>
    )
  }

  if (!tracks.length) return null

  return (
    <div className='border-t border-border/40'>
      <p className='px-4 py-3 text-xs text-muted-foreground'>
        {tracks.length} {tracks.length === 1 ? 'track' : 'tracks'}
      </p>
      <div
        role='region'
        aria-label='Track list'
        className='max-h-80 overflow-y-auto overscroll-contain px-2 pb-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring'>
        <ol className='m-0 list-none p-0'>
          {tracks.map((track, index) => (
            <li
              key={track.key}
              className='flex flex-wrap items-center gap-x-3 gap-y-2 rounded-sm px-2 py-3 hover:bg-muted/50'>
              <span
                aria-hidden='true'
                className='w-6 shrink-0 text-right text-xs tabular-nums text-muted-foreground'>
                {index + 1}
              </span>
              <div className='min-w-0 flex-1 basis-32'>
                {track.spotifyUrl ? (
                  <a
                    href={track.spotifyUrl}
                    target='_blank'
                    rel='noopener noreferrer'
                    className='block truncate text-sm font-medium text-foreground hover:underline'>
                    {track.title}
                  </a>
                ) : (
                  <p className='truncate text-sm font-medium text-foreground'>{track.title}</p>
                )}
                {track.artists ? (
                  <p className='truncate text-xs text-muted-foreground'>{track.artists}</p>
                ) : null}
              </div>
              {showPlaybackControls && track.spotifyUrl ? (
                <SpotifyEntityActions url={track.spotifyUrl} />
              ) : null}
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}
