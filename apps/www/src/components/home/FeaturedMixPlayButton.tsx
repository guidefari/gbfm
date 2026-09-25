import {
  PlayerProvider,
  useNowPlayingTrack,
  usePlayerActions,
  useTransport
} from '@/services/player'
import { toQueueTrack, type PlayableAudio } from '@/services/player/toQueueTrack'
import { Disc3, Pause, Play } from 'lucide-react'
import { useState } from 'react'

function PlayButton({ mix }: { readonly mix: PlayableAudio }) {
  const [error, setError] = useState<string | null>(null)
  const currentTrack = useNowPlayingTrack()
  const { isPlaying } = useTransport()
  const { playTrack, togglePlayPause } = usePlayerActions()
  const isLoaded = currentTrack?.id === mix.id
  const showPause = isLoaded && isPlaying

  const handlePlay = () => {
    setError(null)
    if (isLoaded) return togglePlayPause()
    if (!mix.url) return setError('No audio available for this mix')
    playTrack(toQueueTrack(mix))
  }

  return (
    <>
      <button
        type='button'
        onClick={handlePlay}
        className='inline-flex w-full items-center justify-center gap-2 bg-highlight px-5 py-3 text-base font-bold tracking-widest text-highlight-foreground transition-colors hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'>
        {showPause ? <Pause className='h-5 w-5' /> : <Play className='h-5 w-5' />}
        <span>{showPause ? 'Pause' : isLoaded ? 'Resume' : 'Play mix'}</span>
      </button>
      {error && <p className='text-xs font-bold tracking-widest text-red-500'>{error}</p>}
    </>
  )
}

export function FeaturedMixPlayButton({ mix }: { readonly mix?: PlayableAudio }) {
  if (!mix) {
    return (
      <button
        type='button'
        disabled
        className='inline-flex w-full cursor-not-allowed items-center justify-center gap-2 bg-highlight px-5 py-3 text-base font-bold tracking-widest text-highlight-foreground opacity-50'>
        <Disc3 className='h-5 w-5' />
        <span>No mix available</span>
      </button>
    )
  }

  // PlayerProvider shares the module-level player runtime and Effect atoms with persistent chrome.
  return (
    <PlayerProvider>
      <PlayButton mix={mix} />
    </PlayerProvider>
  )
}
