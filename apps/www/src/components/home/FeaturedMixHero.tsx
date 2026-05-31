import { Link, useNavigate } from '@tanstack/react-router'
import { Disc3, Pause, Play, Radio } from 'lucide-react'
import { useState } from 'react'
import { DEFAULT_IMAGE_URL } from '@/lib/constants'
import { useFeaturedMix } from '@/lib/useFeaturedMix'
import {
  useAudioPlayerActions,
  useAudioPlayerPlaybackState
} from '@/store/audioPlayer'
import { useUIStore } from '@/store/ui'

function CreatorNames({
  creators
}: {
  creators?: { id: string; name: string; username: string | null }[]
}) {
  if (!creators || creators.length === 0) return null
  return (
    <p className='text-sm text-secondary-foreground'>
      {creators.map((c) => c.name).join(', ')}
    </p>
  )
}

export function FeaturedMixHero() {
  const { data: featuredMix, isPending } = useFeaturedMix()
  const { loadTrack, play, pause } = useAudioPlayerActions()
  const { audioSrc, isPlaying, currentTrackId } = useAudioPlayerPlaybackState()
  const navigate = useNavigate()
  const openCmd = useUIStore((s) => s.openCmd)
  const [error, setError] = useState<string | null>(null)

  const isThisMixLoaded =
    Boolean(audioSrc) && currentTrackId === featuredMix?.id

  const handlePlay = () => {
    if (!featuredMix) return
    setError(null)

    if (isThisMixLoaded) {
      isPlaying ? pause() : play()
      return
    }

    if (!featuredMix.url) {
      setError('No audio available for this mix')
      return
    }

    loadTrack(
      featuredMix.url,
      featuredMix.thumbnailUrl || '',
      featuredMix.title,
      featuredMix.id,
      featuredMix.creators,
      featuredMix.slug
    )
  }

  const showPause = isThisMixLoaded && isPlaying

  return (
    <div className='flex flex-col items-center w-full gap-6'>
      <div className='flex flex-col items-center w-full gap-4'>
        {featuredMix ? (
          <Link
            to='/mixes/$mixId'
            params={{ mixId: featuredMix.slug }}
            className='group'>
            <img
              src={featuredMix.thumbnailUrl || DEFAULT_IMAGE_URL}
              alt={featuredMix.title}
              className='object-cover w-40 h-40 transition-opacity rounded-sm md:w-48 md:h-48 group-hover:opacity-80'
            />
          </Link>
        ) : (
          <div className='w-40 h-40 rounded-sm md:w-48 md:h-48 bg-muted animate-pulse' />
        )}
        <div className='text-center'>
          <p className='text-xs tracking-wider uppercase text-muted-foreground/70'>
            Featured mix
          </p>
          {featuredMix ? (
            <>
              <Link
                to='/mixes/$mixId'
                params={{ mixId: featuredMix.slug }}
                className='text-lg font-semibold hover:underline'>
                {featuredMix.title}
              </Link>
              <CreatorNames creators={featuredMix.creators} />
            </>
          ) : (
            <>
              <div className='w-40 h-6 mx-auto rounded-sm bg-muted animate-pulse' />
              <div className='w-24 h-4 mx-auto mt-1 rounded-sm bg-muted animate-pulse' />
            </>
          )}
        </div>
      </div>

      <div className='flex flex-col items-stretch w-full gap-3'>
        <button
          type='button'
          onClick={handlePlay}
          disabled={isPending || !featuredMix}
          className='inline-flex items-center justify-center gap-3 px-6 py-4 text-base font-semibold transition-colors rounded-sm bg-highlight text-gb-bg hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 disabled:cursor-not-allowed'>
          {isPending ? (
            <>
              <Disc3 className='w-5 h-5 animate-spin' />
              <span>Loading...</span>
            </>
          ) : showPause ? (
            <>
              <Pause className='w-5 h-5' />
              <span>Pause</span>
            </>
          ) : (
            <>
              <Play className='w-5 h-5' />
              <span>{isThisMixLoaded ? 'Resume' : 'Play featured mix'}</span>
            </>
          )}
        </button>

        <button
          type='button'
          onClick={() => navigate({ to: '/shows' })}
          className='inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-medium transition-colors border rounded-sm border-border text-secondary-foreground hover:text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'>
          <Radio className='w-4 h-4' />
          <span>Browse radio shows</span>
        </button>

        {error && <p className='text-sm text-center text-red-500'>{error}</p>}

        <button
          type='button'
          onClick={openCmd}
          className='hidden lg:flex items-center gap-2 mt-1 text-secondary-foreground transition-colors hover:text-highlight'>
          <kbd className='inline-flex h-5 bg-muted text-secondary-foreground items-center gap-1 border px-1.5 font-mono text-[10px] font-medium select-none'>
            <span className='text-xs'>
              {typeof navigator !== 'undefined' &&
              navigator.platform.includes('Mac')
                ? '⌘'
                : 'Ctrl'}
            </span>
            K
          </kbd>
          <span className='text-xs'>navigate</span>
        </button>
      </div>
    </div>
  )
}
