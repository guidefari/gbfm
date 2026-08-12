import { ExternalLink } from 'lucide-react'
import { SPOTIFY_GREEN, SpotifyIcon } from '@/components/icons/BrandIcons'
import { SpotifyEntityActions } from '@/components/spotify/SpotifyEntityActions'

const PLATFORM_LABELS = new Map([
  ['spotify', 'Spotify'],
  ['youtube', 'YouTube'],
  ['youtube_music', 'YT Music'],
  ['apple_music', 'Apple Music'],
  ['bandcamp', 'Bandcamp'],
  ['soundcloud', 'SoundCloud'],
  ['tidal', 'Tidal'],
  ['deezer', 'Deezer'],
  ['amazon_music', 'Amazon Music'],
  ['website', 'Website'],
  ['other', 'Link']
])

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
    <div className='pointer-events-auto flex flex-wrap items-center gap-2'>
      {links.map((link) => {
        const label = PLATFORM_LABELS.get(link.platform) ?? link.platform

        return (
          <a
            key={link.platform}
            href={link.url}
            target='_blank'
            rel='noopener noreferrer'
            onClick={(e) => e.stopPropagation()}
            className='inline-flex h-7 items-center gap-1.5 rounded-sm border border-border px-2.5 text-xs font-medium text-muted-foreground no-underline transition-colors hover:border-border hover:bg-muted hover:text-foreground'>
            {link.platform === 'spotify' ? (
              <SpotifyIcon aria-hidden className='h-3.5 w-3.5' style={{ color: SPOTIFY_GREEN }} />
            ) : null}
            {label}
            <ExternalLink className='h-3 w-3 opacity-40' />
          </a>
        )
      })}
      {spotifyLink ? <SpotifyEntityActions url={spotifyLink.url} /> : null}
    </div>
  )
}
