import { ExternalLink } from 'lucide-react'
import { SPOTIFY_GREEN, SpotifyIcon } from '@/components/icons/BrandIcons'
import { SpotifyEntityActions } from '@/components/spotify/SpotifyEntityActions'

const PLATFORM_LABELS: Record<string, string> = {
  spotify: 'Spotify',
  youtube: 'YouTube',
  youtube_music: 'YT Music',
  apple_music: 'Apple Music',
  bandcamp: 'Bandcamp',
  soundcloud: 'SoundCloud',
  tidal: 'Tidal',
  deezer: 'Deezer',
  amazon_music: 'Amazon Music',
  website: 'Website',
  other: 'Link'
}

type StreamLink = {
  platform: string
  url: string
}

type Props = {
  links: StreamLink[]
}

export function StreamLinks({ links }: Props) {
  if (!links.length) return null

  const spotifyLink = links.find((link) => link.platform === 'spotify')

  return (
    <div className='pointer-events-auto flex flex-wrap items-center gap-1.5'>
      <span className='text-[10px] font-bold tracking-widest text-muted-foreground/50'>Stream</span>
      {links.map((link) => {
        const label = PLATFORM_LABELS[link.platform] ?? link.platform

        return (
          <a
            key={link.platform}
            href={link.url}
            target='_blank'
            rel='noopener noreferrer'
            onClick={(e) => e.stopPropagation()}
            className='inline-flex items-center gap-0.5 rounded-sm bg-muted/50 px-1.5 py-0.5 text-[10px] font-bold tracking-widest text-muted-foreground transition-colors hover:bg-muted hover:text-foreground'>
            {link.platform === 'spotify' ? (
              <SpotifyIcon aria-hidden className='h-2.5 w-2.5' style={{ color: SPOTIFY_GREEN }} />
            ) : null}
            {label}
            <ExternalLink className='h-2.5 w-2.5 opacity-50' />
          </a>
        )
      })}
      {spotifyLink ? <SpotifyEntityActions url={spotifyLink.url} /> : null}
    </div>
  )
}
