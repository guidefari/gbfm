import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ExternalLink, GripVertical, Trash2 } from 'lucide-react'
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
import { Button } from '@/components/ui/button'
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

function pickPrimary(links: PlaylistTrackLink[]) {
  if (!links || links.length === 0) return null
  const order = [
    'spotify',
    'apple_music',
    'youtube_music',
    'youtube',
    'bandcamp'
  ]
  for (const platform of order) {
    const found = links.find((l) => l.platform === platform)
    if (found) return found
  }
  return links[0]
}

interface Props {
  track: PlaylistTrackRow
  onRemove: (trackId: string) => void
  removeDisabled: boolean
}

export function SortableTrackRow({ track, onRemove, removeDisabled }: Props) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: track.trackId })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className='group flex items-center gap-3 px-2 py-1.5 border border-transparent rounded hover:bg-muted/40 hover:border-border'>
      <button
        type='button'
        className='opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing touch-none text-muted-foreground hover:text-foreground'
        {...attributes}
        {...listeners}
        aria-label='Drag handle'>
        <GripVertical className='w-4 h-4' />
      </button>
      <span className='text-xs text-muted-foreground w-6 text-right'>
        {track.position + 1}
      </span>
      {track.coverImageUrl ? (
        <img
          src={track.coverImageUrl}
          alt=''
          className='w-10 h-10 rounded object-cover'
        />
      ) : (
        <div className='w-10 h-10 rounded bg-muted' />
      )}
      <div className='flex-1 min-w-0'>
        <div className='text-sm font-medium truncate'>
          {(() => {
            const primary = pickPrimary(track.links)
            return primary ? (
              <a
                href={primary.url}
                target='_blank'
                rel='noopener noreferrer'
                className='hover:underline'
                title={`Open on ${PLATFORM_LABELS[primary.platform] ?? primary.platform}`}>
                {track.title}
              </a>
            ) : (
              track.title
            )
          })()}
        </div>
        <div className='text-xs text-muted-foreground truncate'>
          {track.artistNames?.join(', ') ?? ''}
        </div>
        {track.links && track.links.length > 1 && (
          <div className='mt-1 flex flex-wrap gap-1.5'>
            {track.links.map((link) => {
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
                  className='inline-flex items-center justify-center w-5 h-5 text-muted-foreground hover:text-foreground transition-colors'
                  style={
                    entry
                      ? ({
                          '--brand': entry.color
                        } as React.CSSProperties)
                      : undefined
                  }
                  onMouseEnter={(e) => {
                    if (entry) e.currentTarget.style.color = entry.color
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = ''
                  }}>
                  <Icon className='w-full h-full' />
                </a>
              )
            })}
          </div>
        )}
      </div>
      {(() => {
        const spotifyLink = track.links.find((l) => l.platform === 'spotify')
        return spotifyLink ? (
          <div className='opacity-0 group-hover:opacity-100 transition-opacity'>
            <TrackPlaybackControls spotifyUrl={spotifyLink.url} />
          </div>
        ) : null
      })()}
      <Button
        type='button'
        variant='ghost'
        size='sm'
        onClick={() => onRemove(track.trackId)}
        disabled={removeDisabled}
        aria-label='Remove track'
        className='opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive'>
        <Trash2 className='w-4 h-4' />
      </Button>
    </div>
  )
}
