'use client'
import {
  ChevronDown,
  List,
  MoreHorizontal,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
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
import { useAudioPlayerActions, useAudioPlayerState } from '@/store/audioPlayer'

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
    repeatMode,
    isShuffled,
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
    toggleRepeat,
    toggleShuffle,
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

  const getRepeatIcon = () => {
    switch (repeatMode) {
      case 'one':
        return <Repeat1 className='w-6 h-6' />
      case 'all':
        return <Repeat className='w-6 h-6' />
      default:
        return <Repeat className='w-6 h-6' />
    }
  }

  const currentTrack = audioSrc
    ? {
        title: nowPlayingContext.title,
        thumbnailUrl: thumbnailUrl,
        artist: 'Mix' // Default since we don't have artist field
      }
    : null

  if (!currentTrack || !isFullscreenVisible) return null

  return (
    <div
      className={`fixed inset-0 z-50 bg-gradient-to-br from-background via-card to-secondary text-foreground transition-transform duration-500 ease-out flex flex-col ${
        isFullscreenVisible ? 'translate-y-0' : 'translate-y-full'
      }`}>
      {/* Header */}
      <div className='flex items-center justify-between flex-shrink-0 p-6'>
        <Button
          variant='ghost'
          size='sm'
          onClick={toggleFullscreen}
          className='text-muted-foreground hover:text-foreground hover:bg-muted'>
          <ChevronDown className='w-6 h-6' />
        </Button>
        <Button
          variant='ghost'
          size='sm'
          className='text-muted-foreground hover:text-foreground hover:bg-muted'>
          <MoreHorizontal className='w-6 h-6' />
        </Button>
      </div>

      <div className='flex items-center justify-center flex-1 min-h-0 px-8 pb-8'>
        {/* Left Panel - Now Playing */}
        <div className='flex flex-col max-w-2xl'>
          {/* Album Artwork */}
          <div className='relative mb-8'>
            <div className='w-full max-w-md mx-auto overflow-hidden shadow-2xl bg-gradient-to-br rounded-3xl aspect-square from-primary/20 to-accent'>
              <img
                src={currentTrack.thumbnailUrl || DEFAULT_IMAGE_URL}
                alt={currentTrack.title}
                className='object-cover w-full h-full'
              />
            </div>
          </div>

          {/* Track Info */}
          <div className='mb-8'>
            <div className='flex items-center justify-between mb-2'>
              <h1 className='pr-4 text-2xl font-semibold leading-tight'>
                {currentTrack.title}
              </h1>
              <div className='flex items-center flex-shrink-0 gap-2'>
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
                    <span className='absolute flex items-center justify-center w-4 h-4 text-xs rounded-full -top-1 -right-1 bg-primary text-primary-foreground'>
                      {queue.length}
                    </span>
                  )}
                </Button>
                <Button
                  variant='ghost'
                  size='icon'
                  className='text-muted-foreground hover:text-foreground hover:bg-muted'>
                  <MoreHorizontal className='w-5 h-5' />
                </Button>
              </div>
            </div>
            <p className='text-lg text-muted-foreground'>
              {currentTrack.artist}
            </p>
          </div>

          {/* Progress Bar */}
          <div className='mb-8'>
            <input
              type='range'
              value={progress}
              onChange={handleProgressChange}
              max={100}
              step={0.1}
              className='w-full h-2 bg-muted rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow-lg'
            />
            <div className='flex justify-between mt-2 text-sm text-muted-foreground'>
              <span>{formatSeconds(currentTime)}</span>
              <span>-{formatSeconds(duration - currentTime)}</span>
            </div>
          </div>

          {/* Controls */}
          <div className='flex items-center justify-center gap-6 mb-8'>
            <Button
              variant='ghost'
              size='icon'
              onClick={toggleShuffle}
              className={`hover:bg-muted ${isShuffled ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
              <Shuffle className='w-6 h-6' />
            </Button>
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
              className='w-16 h-16 rounded-full backdrop-blur-sm bg-primary/20 hover:bg-primary/30'
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
            <Button
              variant='ghost'
              size='icon'
              onClick={toggleRepeat}
              className={`hover:bg-muted ${repeatMode !== 'none' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
              {getRepeatIcon()}
            </Button>
          </div>

          {/* Volume Control */}
          <div className='flex items-center gap-4'>
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
              className='flex-1 h-2 bg-muted rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow-lg'
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
