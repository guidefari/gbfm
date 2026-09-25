import { Badge, PlayToggle } from '@gbfm/ui'
import { useSession } from '@/lib/auth-client'
import { cn } from '@/lib/utils'
import { PlayerProvider } from '@/services/player'
import { useNowPlayingTrack, usePlayerActions, useTransport } from '@/services/player'
import { toPlaybackState } from '@/services/player/toPlaybackState'
import { toQueueTrack } from '@/services/player/toQueueTrack'

type SerializableEpisode = {
  readonly id: string
  readonly slug: string
  readonly title: string
  readonly url: string
  readonly type: 'mix' | 'track' | 'misc'
  readonly thumbnailUrl: string | null
  readonly draft: boolean
  readonly createdAt: string
  readonly creators?: ReadonlyArray<{
    readonly id: string
    readonly name: string
    readonly username: string | null
  }>
}

function Episode({ episode }: { readonly episode: SerializableEpisode }) {
  const current = useNowPlayingTrack()
  const { isPlaying, isBuffering, isLoaded } = useTransport()
  const { playTrack, togglePlayPause } = usePlayerActions()
  const { data: session } = useSession()
  const isActive = current?.id === episode.id
  const isAdmin = session?.user?.role === 'admin'

  const handlePlay = () => {
    if (isActive) togglePlayPause()
    else
      playTrack(
        toQueueTrack({ ...episode, creators: episode.creators ? [...episode.creators] : undefined })
      )
  }

  return (
    <article
      data-testid='episode-row'
      className={cn(
        'group/item flex max-w-2xl items-center gap-2 border-b border-border/40 px-1 py-1.5 text-base transition-colors duration-150 last:border-b-0',
        isActive && 'text-highlight'
      )}>
      <PlayToggle
        state={toPlaybackState({ isCurrent: isActive, isPlaying, isBuffering, isLoaded })}
        variant='icon'
        label={episode.title}
        onToggle={handlePlay}
        className={cn(
          'shrink-0 transition-opacity',
          !isActive && 'opacity-40 group-hover/item:opacity-100 group-focus-within/item:opacity-100'
        )}
      />
      <a
        href={`/mixes/${encodeURIComponent(episode.slug)}`}
        className={cn(
          'min-w-0 shrink truncate transition-colors group-hover/item:text-highlight',
          isActive ? 'text-highlight' : 'text-foreground'
        )}>
        {episode.title}
      </a>
      {isAdmin && episode.draft && <Badge variant='secondary'>Draft</Badge>}
      <time className='shrink-0 text-[11px] tracking-widest text-muted-foreground'>
        {new Date(episode.createdAt).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        })}
      </time>
      {episode.creators?.length ? (
        <span className='hidden min-w-0 truncate text-muted-foreground sm:inline'>
          {episode.creators.map((creator, index) => (
            <span key={creator.id}>
              {creator.username ? (
                <a
                  href={`/profile/${encodeURIComponent(creator.username)}`}
                  className='hover:underline'>
                  {creator.name}
                </a>
              ) : (
                creator.name
              )}
              {index < (episode.creators?.length ?? 0) - 1 && (
                <span className='mx-1 opacity-50'>&amp;</span>
              )}
            </span>
          ))}
        </span>
      ) : null}
    </article>
  )
}

export function ShowEpisodes({ episodes }: { readonly episodes: readonly SerializableEpisode[] }) {
  return (
    <PlayerProvider>
      <div className='font-jetbrains'>
        {episodes.map((episode) => (
          <Episode key={episode.id} episode={episode} />
        ))}
      </div>
    </PlayerProvider>
  )
}
