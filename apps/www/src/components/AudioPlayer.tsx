'use client'
import { Link, useRouter } from '@tanstack/react-router'
import React, { useRef } from 'react'
import { GiPauseButton, GiPlayButton } from 'react-icons/gi'
import { HiHome } from 'react-icons/hi'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui/tooltip'
import { useAudioPlayerContext } from '@/contexts/AudioPlayer'
import { useScrollStatus } from '@/lib/useScrollStatus'
import { formatSeconds } from '@/lib/utils'

const AudioPlayer = () => {
  const [
    audioRef,
    handlers,
    isPlaying,
    thumbnailUrl,
    progress,
    nowPlayingContext
  ] = useAudioPlayerContext()
  const router = useRouter()
  const navRef = useRef<HTMLElement>(null)
  const isScrolling = useScrollStatus(1000)

  const navStyles = isScrolling ? 'opacity-95' : 'opacity-100'

  // lol, the other half of this is at AppShell.tsx
  React.useEffect(() => {
    if (navRef.current) {
      const height = navRef.current.offsetHeight
      document.documentElement.style.setProperty(
        '--audio-player-height',
        `${height}px`
      )
    }

    return () => {
      document.documentElement.style.removeProperty('--audio-player-height')
    }
  }, [])

  const changeRange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target
    handlers.setTimeUsingPercentage(Number(value))
  }

  if (!audioRef?.src) return <></>

  return (
    <nav
      ref={navRef}
      className={`fixed bottom-0 z-50 py-2 space-y-1 w-full border-t transition ease-in-out delay-150 bg-background border-border ${navStyles}`}>
      <div className='grid relative grid-flow-col items-center mx-auto max-w-xs h-full'>
        <button
          onClick={() => router.navigate({ to: '/' })}
          data-tooltip-target='tooltip-home'
          type='button'
          className='floating-nav-button'>
          <HiHome className='floating-nav-icon' />
        </button>

        <button
          data-tooltip-target='tooltip-wallet'
          type='button'
          className='text-xs floating-nav-button'
          onClick={() => handlers.jumpBackward()}>
          -15s
        </button>
        <button
          type='button'
          className='floating-nav-button'
          title='Play/Pause'
          onClick={() =>
            isPlaying
              ? handlers.pause()
              : handlers.play({ title: nowPlayingContext.title })
          }>
          {isPlaying ? (
            <GiPauseButton className='floating-nav-icon' />
          ) : (
            <GiPlayButton className='floating-nav-icon' />
          )}
        </button>
        <button
          data-tooltip-target='tooltip-settings'
          type='button'
          className='text-xs floating-nav-button'
          title='+30s'
          onClick={() => handlers.jumpForward()}>
          +30s
        </button>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Link to={nowPlayingContext.url}>
                <img
                  src={thumbnailUrl}
                  className='min-w-[45px] w-12 m-auto rounded-md aspect-square'
                  alt={nowPlayingContext.title}
                  width={80}
                  height={80}
                />
              </Link>
            </TooltipTrigger>
            <TooltipContent side='top'>
              {nowPlayingContext.title}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      <div className='flex items-center mx-auto space-x-1 max-w-xl rounded-full'>
        <p className='text-xs'>{formatSeconds(audioRef?.currentTime || 0)}</p>
        <input
          type='range'
          value={progress}
          className='w-full h-2 rounded-full bg-gb-tomato align-start hover:cursor-pointer'
          onInput={changeRange}
        />
        <p className='text-xs'>{formatSeconds(audioRef?.duration || 0)}</p>
      </div>
    </nav>
  )
}

export default AudioPlayer
