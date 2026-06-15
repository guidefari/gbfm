import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Button } from '@gbfm/ui'
import { Link } from '@tanstack/react-router'
import { ExternalLink, GripVertical, Pencil, Trash2 } from 'lucide-react'
import type { IconType } from 'react-icons'

import {
  SiApplemusic,
  SiBandcamp,
  SiDiscord,
  SiInstagram,
  SiMusicbrainz,
  SiSoundcloud,
  SiSpotify,
  SiTidal,
  SiX,
  SiYoutube,
  SiYoutubemusic
} from 'react-icons/si'
import { CoverThumb } from '@/components/CoverThumb'
import { spotifyIdFromUrl } from '@/lib/spotify-pkce'
import { TrackPlaybackControls } from './-TrackPlaybackControls'

export interface PlaylistTrackLink {
  id: string
  platform: string
  url: string
}

export interface PlaylistTrackRow {
  trackId: string
  position: number
  title: string
  artistNames: string[] | null
  coverImageUrl: string | null
  links: PlaylistTrackLink[]
}

const PLATFORM_LABELS: Record<string, string> = {
  spotify: 'Spotify',
  youtube: 'YouTube',
  youtube_music: 'YouTube Music',
  apple_music: 'Apple Music',
  bandcamp: 'Bandcamp',
  soundcloud: 'SoundCloud',
  tidal: 'Tidal',
  deezer: 'Deezer',
  amazon_music: 'Amazon Music',
  discord: 'Discord',
  website: 'Website',
  instagram: 'Instagram',
  twitter: 'Twitter',
  musicbrainz: 'MusicBrainz',
  other: 'Other'
}

const PLATFORM_ICONS: Record<string, { Icon: IconType; color: string }> = {
  spotify: { Icon: SiSpotify, color: '#1DB954' },
  youtube: { Icon: SiYoutube, color: '#FF0000' },
  youtube_music: { Icon: SiYoutubemusic, color: '#FF0000' },
  apple_music: { Icon: SiApplemusic, color: '#FA243C' },
  bandcamp: { Icon: SiBandcamp, color: '#629AA9' },
  soundcloud: { Icon: SiSoundcloud, color: '#FF5500' },
  tidal: { Icon: SiTidal, color: '#000000' },
  discord: { Icon: SiDiscord, color: '#5865F2' },
  instagram: { Icon: SiInstagram, color: '#E4405F' },
  twitter: { Icon: SiX, color: '#000000' },
  musicbrainz: { Icon: SiMusicbrainz, color: '#BA478F' }
}

const PLATFORM_PRIORITY = ['spotify', 'apple_music', 'youtube_music', 'youtube', 'bandcamp']

function pickPrimary(links: PlaylistTrackLink[]): PlaylistTrackLink | null {
  if (!links.length) return null
  const linksByPlatform = new Map(links.map((link) => [link.platform, link]))
  for (const platform of PLATFORM_PRIORITY) {
    const found = linksByPlatform.get(platform)
    if (found) return found
  }
  return links[0] ?? null
}

function TrackTitle({ title, links }: { title: string; links: PlaylistTrackLink[] }) {
  const primary = pickPrimary(links)
  if (!primary) return <>{title}</>
  return (
    <a
      href={primary.url}
      target='_blank'
      rel='noopener noreferrer'
      className='hover:underline'
      title={`Open on ${PLATFORM_LABELS[primary.platform] ?? primary.platform}`}>
      {title}
    </a>
  )
}

interface Props {
  track: PlaylistTrackRow
  savedSpotifyTrackIds: Map<string, boolean>
  onSpotifyTrackSaved: (spotifyTrackId: string) => void
  onRemove: (trackId: string) => void
  removeDisabled: boolean
}

export function SortableTrackRow({
  track,
  savedSpotifyTrackIds,
  onSpotifyTrackSaved,
  onRemove,
  removeDisabled
}: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: track.trackId
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1
  }

  const spotifyLink = track.links.find((l) => l.platform === 'spotify')
  const spotifyTrackId = spotifyLink ? spotifyIdFromUrl(spotifyLink.url) : null

  return (
    <div
      ref={setNodeRef}
      style={style}
      className='group flex items-center gap-3 px-4 py-2 transition-colors hover:bg-muted/30'>
      <button
        type='button'
        className='cursor-grab touch-none text-muted-foreground/60 transition-colors hover:text-foreground active:cursor-grabbing'
        {...attributes}
        {...listeners}
        aria-label='Drag handle'>
        <GripVertical className='size-4' />
      </button>

      <span className='w-6 text-right text-xs tabular-nums text-muted-foreground'>
        {track.position + 1}
      </span>

      <CoverThumb src={track.coverImageUrl} className='size-9 shrink-0 rounded-sm' />

      <div className='min-w-0 flex-1'>
        <div className='truncate text-sm font-medium'>
          <TrackTitle title={track.title} links={track.links} />
        </div>
        <div className='truncate text-xs text-muted-foreground'>
          {track.artistNames?.join(', ') ?? '—'}
        </div>
      </div>

      <div className='hidden items-center gap-1.5 md:flex'>
        {track.links.slice(0, 6).map((link) => {
          const entry = PLATFORM_ICONS[link.platform]
          const Icon = entry?.Icon ?? ExternalLink
          const label = PLATFORM_LABELS[link.platform] ?? link.platform
          return (
            <a
              key={link.id}
              href={link.url}
              target='_blank'
              rel='noopener noreferrer'
              title={label}
              aria-label={label}
              className='inline-flex size-5 items-center justify-center text-muted-foreground transition-colors hover:text-foreground'
              style={entry ? { color: entry.color } : undefined}>
              <Icon className='size-4' />
            </a>
          )
        })}
        {track.links.length > 6 && (
          <span className='text-xs text-muted-foreground'>+{track.links.length - 6}</span>
        )}
      </div>

      {spotifyLink && spotifyTrackId && (
        <div className='transition-opacity md:opacity-0 md:group-hover:opacity-100'>
          <TrackPlaybackControls
            spotifyUrl={spotifyLink.url}
            saved={savedSpotifyTrackIds.get(spotifyTrackId) ?? null}
            onSaved={onSpotifyTrackSaved}
          />
        </div>
      )}

      <Button
        asChild
        type='button'
        variant='ghost'
        size='sm'
        aria-label='Edit track'
        className='text-muted-foreground transition-opacity md:opacity-0 md:group-hover:opacity-100'>
        <Link
          to='/admin/music-entity/$entityType/$id'
          params={{ entityType: 'track', id: track.trackId }}>
          <Pencil className='size-4' />
        </Link>
      </Button>

      <Button
        type='button'
        variant='ghost'
        size='sm'
        onClick={() => onRemove(track.trackId)}
        disabled={removeDisabled}
        aria-label='Remove track'
        className='text-muted-foreground transition-opacity hover:text-destructive md:opacity-0 md:group-hover:opacity-100'>
        <Trash2 className='size-4' />
      </Button>
    </div>
  )
}
