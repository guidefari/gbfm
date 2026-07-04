import { Link } from '@tanstack/react-router'
import { Disc3, Pause, Play, Radio } from 'lucide-react'
import { DEFAULT_IMAGE_URL } from '@/lib/constants'
import type { FeaturedMixVariantProps } from './types'

export function VariantOverlay({
  featuredMix,
  isPending,
  showPause,
  isThisMixLoaded,
  error,
  onPlay,
  onBrowse
}: FeaturedMixVariantProps) {
  return (
    <div className='flex flex-col w-full gap-3'>
      <div className='relative w-full overflow-hidden border-2 aspect-square border-foreground'>
        {featuredMix ? (
          <img
            src={featuredMix.thumbnailUrl || DEFAULT_IMAGE_URL}
            alt={featuredMix.title}
            className='absolute inset-0 object-cover w-full h-full'
          />
        ) : (
          <div className='absolute inset-0 bg-muted animate-pulse' />
        )}

        <div className='absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent' />

        <div className='absolute inset-0 flex flex-col justify-between p-3'>
          <span className='self-start px-2 py-1 text-[10px] font-bold uppercase tracking-[0.25em] leading-none bg-highlight text-highlight-foreground'>
            Featured
          </span>

          <div className='flex flex-col gap-3'>
            {featuredMix ? (
              <div>
                <Link
                  to='/mixes/$mixId'
                  params={{ mixId: featuredMix.slug }}
                  className='text-2xl font-black leading-[0.95] tracking-tight uppercase text-white hover:underline decoration-highlight decoration-2'>
                  {featuredMix.title}
                </Link>
                {featuredMix.creators?.length ? (
                  <p className='mt-1 text-xs font-bold tracking-widest uppercase text-white/70'>
                    {featuredMix.creators.map((c) => c.name).join(', ')}
                  </p>
                ) : null}
              </div>
            ) : (
              <div>
                <div className='w-32 h-7 bg-white/20 animate-pulse' />
                <div className='w-20 h-4 mt-1 bg-white/20 animate-pulse' />
              </div>
            )}

            <button
              type='button'
              onClick={onPlay}
              disabled={isPending || !featuredMix}
              className='inline-flex items-center justify-center w-full gap-2 px-5 py-3 text-sm font-bold tracking-widest uppercase transition-colors bg-highlight text-highlight-foreground hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 disabled:cursor-not-allowed'>
              {isPending ? (
                <Disc3 className='w-5 h-5 animate-spin' />
              ) : showPause ? (
                <Pause className='w-5 h-5' />
              ) : (
                <Play className='w-5 h-5' />
              )}
              <span>{showPause ? 'Pause' : isThisMixLoaded ? 'Resume' : 'Play mix'}</span>
            </button>
          </div>
        </div>
      </div>

      <button
        type='button'
        onClick={onBrowse}
        className='inline-flex items-center justify-center w-full gap-2 px-5 py-3 text-xs font-bold tracking-widest uppercase transition-colors border-2 border-foreground text-foreground hover:bg-foreground hover:text-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'>
        <Radio className='w-4 h-4' />
        <span>Browse radio shows</span>
      </button>

      {error && <p className='text-xs font-bold tracking-widest uppercase text-red-500'>{error}</p>}
    </div>
  )
}
