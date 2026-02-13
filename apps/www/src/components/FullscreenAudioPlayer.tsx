'use client'
import { Link } from '@tanstack/react-router'
import {
  ChevronDown,
  List,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Star,
  Volume2,
  VolumeX
} from 'lucide-react'
import type React from 'react'
import { useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { DEFAULT_IMAGE_URL } from '@/lib/constants'
import { formatSeconds } from '@/lib/utils'
import { attachVolumeScroll } from '@/lib/volumeScrollHandler'
import {
  type Creator,
  useAudioPlayerActions,
  useAudioPlayerState
} from '@/store/audioPlayer'

type Props = {
  creators: Creator[]
  onClick?: (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void
}

function CreatorLinks({ creators, onClick }: Props) {
  if (!creators || creators.length === 0) {
    return <span>Unknown creator</span>
  }

  return (
    <>
      {creators.map((creator, index) => (
        <span key={creator.id}>
          {creator.username ? (
            <Link
              to='/profile/$username'
              params={{ username: creator.username }}
              className='hover:text-foreground hover:underline'
              onClick={onClick}>
              {creator.name}
            </Link>
          ) : (
            <span>{creator.name}</span>
          )}
          {index < creators.length - 1 && ', '}
        </span>
      ))}
    </>
  )
}

const FullscreenAudioPlayer = () => {
  const {
    audioSrc,
    isPlaying,
    thumbnailUrl,
    progress,
    nowPlayingContext,
    currentTime,
    duration,
    volume,
    isMuted,
    queue,
    isFullscreenVisible
  } = useAudioPlayerState()

  const {
    play,
    pause,
    playNext,
    playPrevious,
    setTimeUsingPercentage,
    setVolume,
    toggleMute,
    toggleFullscreen,
    toggleQueue
  } = useAudioPlayerActions()

  const volumeSliderRef = useRef<HTMLInputElement>(null)
  const volumeButtonRef = useRef<HTMLButtonElement>(null)

  // Volume scroll handling
  useEffect(() => {
    const elements = [volumeSliderRef.current, volumeButtonRef.current].filter(
      Boolean
    ) as HTMLElement[]
    const cleanupFunctions = elements.map((element) =>
      attachVolumeScroll(element, {
        onVolumeChange: setVolume,
        getCurrentVolume: () => volume,
        getIsMuted: () => isMuted,
        volumeStep: 6
      })
    )

    return () => {
      for (const cleanup of cleanupFunctions) {
        cleanup()
      }
    }
  }, [volume, isMuted, setVolume])

  const handleProgressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTimeUsingPercentage(Number(e.target.value))
  }

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setVolume(Number(e.target.value))
  }

  const currentTrack = audioSrc
    ? {
        title: nowPlayingContext.title,
        thumbnailUrl: thumbnailUrl,
        creators: nowPlayingContext.creators
      }
    : null

  if (!currentTrack || !isFullscreenVisible) return null

  return (
    <div
      className={`fixed inset-0 z-50 bg-background text-foreground transition-transform duration-500 ease-out flex flex-col ${
        isFullscreenVisible ? 'translate-y-0' : 'translate-y-full'
      }`}>
      <div className='flex items-center justify-between flex-shrink-0 px-4 py-3 sm:p-6'>
        <Button
          variant='ghost'
          size='sm'
          onClick={toggleFullscreen}
          className='text-muted-foreground hover:text-foreground hover:bg-muted'>
          <ChevronDown className='w-6 h-6' />
        </Button>
      </div>

      <div className='flex flex-col items-center flex-1 min-h-0 px-4 pb-6 overflow-hidden sm:justify-center sm:px-8 sm:pb-8'>
        <div className='flex flex-col w-full max-w-2xl min-h-0 flex-1'>
          <div className='flex items-center justify-center mb-4 sm:mb-8 flex-1 min-h-0'>
            <img
              src={currentTrack.thumbnailUrl || DEFAULT_IMAGE_URL}
              alt={currentTrack.title}
              className='max-w-full max-h-full object-contain rounded-sm shadow-2xl'
            />
          </div>

          <div className='mb-4 sm:mb-8 flex-shrink-0'>
            <div className='flex items-center justify-between mb-2'>
              <div className='relative flex-1 min-w-0 pr-4 overflow-hidden'>
                <div className='title-marquee title-marquee--slow flex min-w-max text-xl sm:text-2xl font-semibold leading-tight text-foreground'>
                  <span className='shrink-0 pr-12'>{currentTrack.title}</span>
                  <span aria-hidden='true' className='shrink-0 pr-12'>
                    {currentTrack.title}
                  </span>
                </div>
                <h1 className='sr-only'>{currentTrack.title}</h1>
              </div>
              <div className='flex items-center flex-shrink-0 gap-1 sm:gap-2'>
                <Button
                  variant='ghost'
                  size='icon'
                  className='text-muted-foreground hover:text-foreground hover:bg-muted'>
                  <Star className='w-5 h-5' />
                </Button>
                <Button
                  variant='ghost'
                  size='icon'
                  onClick={toggleQueue}
                  className={`text-muted-foreground hover:text-foreground hover:bg-muted ${queue.length > 0 ? 'relative' : ''}`}
                  title='Toggle Queue'>
                  <List className='w-5 h-5' />
                  {queue.length > 0 && (
                    <span className='absolute flex items-center justify-center w-4 h-4 text-xs rounded-sm -top-1 -right-1 bg-primary text-primary-foreground'>
                      {queue.length}
                    </span>
                  )}
                </Button>
              </div>
            </div>
            {currentTrack?.creators && (
              <CreatorLinks
                creators={currentTrack.creators}
                onClick={toggleFullscreen}
              />
            )}
          </div>

          <div className='mb-4 sm:mb-8 flex-shrink-0'>
            <input
              type='range'
              value={progress}
              onChange={handleProgressChange}
              max={100}
              step={0.1}
              className='w-full h-2 bg-muted rounded-sm appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:rounded-sm [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow-lg'
            />
            <div className='flex justify-between mt-2 text-sm text-muted-foreground'>
              <span>{formatSeconds(currentTime)}</span>
              <span>-{formatSeconds(duration - currentTime)}</span>
            </div>
          </div>

          <div className='flex items-center justify-center gap-6 mb-4 sm:mb-8 flex-shrink-0'>
            <Button
              variant='ghost'
              size='icon'
              onClick={playPrevious}
              className='text-foreground hover:bg-muted'>
              <SkipBack className='w-7 h-7' />
            </Button>
            <Button
              variant='ghost'
              size='icon'
              className='w-16 h-16 rounded-sm backdrop-blur-sm bg-primary/20 hover:bg-primary/30'
              onClick={() =>
                isPlaying ? pause() : play(nowPlayingContext.title)
              }>
              {isPlaying ? (
                <Pause className='w-8 h-8' />
              ) : (
                <Play className='w-8 h-8 ml-1' />
              )}
            </Button>
            <Button
              variant='ghost'
              size='icon'
              onClick={playNext}
              className='text-foreground hover:bg-muted'>
              <SkipForward className='w-7 h-7' />
            </Button>
          </div>

          <div className='hidden sm:flex items-center gap-4'>
            <Button
              ref={volumeButtonRef}
              variant='ghost'
              size='sm'
              onClick={toggleMute}
              className='text-muted-foreground hover:text-foreground hover:bg-muted'
              title={
                isMuted
                  ? 'Unmute (or scroll to adjust)'
                  : 'Mute (or scroll to adjust)'
              }>
              {isMuted || volume === 0 ? (
                <VolumeX className='w-5 h-5' />
              ) : (
                <Volume2 className='w-5 h-5' />
              )}
            </Button>
            <input
              ref={volumeSliderRef}
              type='range'
              min={0}
              max={100}
              value={isMuted ? 0 : volume}
              onChange={handleVolumeChange}
              className='flex-1 h-2 bg-muted rounded-sm appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:rounded-sm [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow-lg'
              title={`Volume: ${volume}% (scroll to adjust)`}
            />
            <Volume2 className='w-5 h-5 text-muted-foreground' />
          </div>
        </div>
      </div>
    </div>
  )
}

export default FullscreenAudioPlayer
