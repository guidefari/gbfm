'use client'
import {
  List,
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

const AudioPlayer = () => {
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
    isShuffled
  } = useAudioPlayerState()

  const {
    play,
    pause,
    playNext,
    playPrevious,
    setTimeUsingPercentage,
    setVolume,
    toggleMute,
    toggleQueue,
    toggleRepeat,
    toggleShuffle,
    toggleFullscreen
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
      cleanupFunctions.forEach((cleanup) => cleanup())
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
        return <Repeat1 className='w-4 h-4' />
      case 'all':
        return <Repeat className='w-4 h-4' />
      default:
        return <Repeat className='w-4 h-4' />
    }
  }

  // Create a current track object from the existing state
  const currentTrack = audioSrc
    ? {
        title: nowPlayingContext.title,
        thumbnailUrl: thumbnailUrl,
        artist: 'Mix' // Default since we don't have artist field
      }
    : null

  if (!currentTrack) return null

  return (
    <div className='flex-shrink-0 border-t backdrop-blur-md bg-background/95 border-border'>
      <div className='px-4 py-3 mx-auto max-w-screen-2xl'>
        {/* Desktop Layout */}
        <div className='hidden md:grid md:grid-cols-3 md:items-center md:gap-4'>
          {/* Left: Track Info */}
          <div className='flex items-center min-w-0 gap-3'>
            <img
              src={currentTrack.thumbnailUrl || DEFAULT_IMAGE_URL}
              alt={currentTrack.title}
              className='flex-shrink-0 object-cover transition-opacity rounded-lg cursor-pointer w-14 h-14 hover:opacity-80'
              onClick={toggleFullscreen}
            />
            <div className='flex-1 min-w-0'>
              <h3 className='text-sm font-medium truncate'>
                {currentTrack.title}
              </h3>
              <p className='px-0 text-xs truncate text-secondary-foreground'>
                {currentTrack.artist}
              </p>
            </div>
            {/* <div className='flex items-center flex-shrink-0 gap-2'>
              <Button variant='ghost' size='icon' className='text-secondary-foreground hover:text-foreground hover:bg-muted'>
                <Star className='w-4 h-4' />
              </Button>
              <Button variant='ghost' size='icon' className='text-secondary-foreground hover:text-foreground hover:bg-muted'>
                <MoreHorizontal className='w-4 h-4' />
              </Button>
            </div> */}
          </div>

          {/* Center: Controls & Progress */}
          <div className='flex flex-col items-center gap-2'>
            <div className='flex items-center gap-2'>
              <Button
                variant='ghost'
                size='icon'
                onClick={toggleShuffle}
                className={`hover:bg-muted ${isShuffled ? 'text-primary' : 'text-secondary-foreground hover:text-foreground'}`}>
                <Shuffle className='w-4 h-4' />
              </Button>
              <Button
                variant='ghost'
                size='icon'
                onClick={playPrevious}
                className='text-foreground hover:bg-muted'>
                <SkipBack className='w-4 h-4' />
              </Button>
              <Button
                variant='ghost'
                size='icon'
                className='w-8 h-8 rounded-full backdrop-blur-sm bg-primary/20 hover:bg-primary/30'
                onClick={() =>
                  isPlaying ? pause() : play(nowPlayingContext.title)
                }>
                {isPlaying ? (
                  <Pause className='w-4 h-4' />
                ) : (
                  <Play className='ml-0.5 w-4 h-4' />
                )}
              </Button>
              <Button
                variant='ghost'
                size='icon'
                onClick={playNext}
                className='text-foreground hover:bg-muted'>
                <SkipForward className='w-4 h-4' />
              </Button>
              <Button
                variant='ghost'
                size='icon'
                onClick={toggleRepeat}
                className={`hover:bg-muted ${repeatMode !== 'none' ? 'text-primary' : 'text-secondary-foreground hover:text-foreground'}`}>
                {getRepeatIcon()}
              </Button>
            </div>

            <div className='flex items-center w-full max-w-md gap-2'>
              <span className='text-xs text-secondary-foreground min-w-[2.5rem] text-right'>
                {formatSeconds(currentTime)}
              </span>
              <input
                type='range'
                value={progress}
                onChange={handleProgressChange}
                max={100}
                step={0.1}
                className='flex-1 h-2 bg-muted rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow-lg'
              />
              <span className='text-xs text-secondary-foreground min-w-[2.5rem]'>
                {formatSeconds(duration)}
              </span>
            </div>
          </div>

          {/* Right: Volume & Queue */}
          <div className='flex items-center justify-end gap-2'>
            <div className='flex items-center gap-2'>
              <Button
                ref={volumeButtonRef}
                variant='ghost'
                size='icon'
                onClick={toggleMute}
                className='text-secondary-foreground hover:text-foreground hover:bg-muted'
                title={
                  isMuted
                    ? 'Unmute (or scroll to adjust)'
                    : 'Mute (or scroll to adjust)'
                }>
                {isMuted || volume === 0 ? (
                  <VolumeX className='w-4 h-4' />
                ) : (
                  <Volume2 className='w-4 h-4' />
                )}
              </Button>
              <input
                ref={volumeSliderRef}
                type='range'
                min={0}
                max={100}
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className='w-20 h-2 bg-muted rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow-lg'
                title={`Volume: ${volume}% (scroll to adjust)`}
              />
            </div>

            <Button
              variant='ghost'
              size='icon'
              onClick={toggleQueue}
              className={`${queue.length > 0 ? 'relative' : ''} text-secondary-foreground hover:text-foreground hover:bg-muted`}>
              <List className='w-4 h-4' />
              {queue.length > 0 && (
                <span className='absolute flex items-center justify-center w-5 h-5 text-xs rounded-full -top-1 -right-1 bg-primary text-primary-foreground'>
                  {queue.length}
                </span>
              )}
            </Button>
          </div>
        </div>

        {/* Mobile Layout */}
        <div className='md:hidden'>
          <div className='flex items-center gap-3 mb-3'>
            <img
              src={currentTrack.thumbnailUrl || DEFAULT_IMAGE_URL}
              alt={currentTrack.title}
              className='object-cover w-12 h-12 transition-opacity rounded-lg cursor-pointer hover:opacity-80'
              onClick={toggleFullscreen}
            />
            <div className='flex-1 min-w-0'>
              <h3 className='text-sm font-medium truncate'>
                {currentTrack.title}
              </h3>
              <p className='text-xs truncate text-secondary-foreground'>
                {currentTrack.artist}
              </p>
            </div>
            <Button
              variant='ghost'
              size='icon'
              onClick={toggleQueue}
              className={`${queue.length > 0 ? 'relative' : ''} text-secondary-foreground hover:text-foreground hover:bg-muted`}>
              <List className='w-4 h-4' />
              {queue.length > 0 && (
                <span className='absolute flex items-center justify-center w-5 h-5 text-xs rounded-full -top-1 -right-1 bg-primary text-primary-foreground'>
                  {queue.length}
                </span>
              )}
            </Button>
          </div>

          <div className='flex items-center gap-2 mb-2'>
            <span className='text-xs text-secondary-foreground min-w-[2.5rem] text-right'>
              {formatSeconds(currentTime)}
            </span>
            <input
              type='range'
              value={progress}
              onChange={handleProgressChange}
              max={100}
              step={0.1}
              className='flex-1 h-2 bg-muted rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow-lg'
            />
            <span className='text-xs text-secondary-foreground min-w-[2.5rem]'>
              {formatSeconds(duration)}
            </span>
          </div>

          <div className='flex items-center justify-between'>
            <div className='flex items-center gap-1'>
              <Button
                variant='ghost'
                size='icon'
                onClick={toggleShuffle}
                className={`hover:bg-muted ${isShuffled ? 'text-primary' : 'text-secondary-foreground hover:text-foreground'}`}>
                <Shuffle className='w-4 h-4' />
              </Button>
              <Button
                variant='ghost'
                size='icon'
                onClick={toggleRepeat}
                className={`hover:bg-muted ${repeatMode !== 'none' ? 'text-primary' : 'text-secondary-foreground hover:text-foreground'}`}>
                {getRepeatIcon()}
              </Button>
            </div>

            <div className='flex items-center gap-2'>
              <Button
                variant='ghost'
                size='icon'
                onClick={playPrevious}
                className='text-foreground hover:bg-muted'>
                <SkipBack className='w-5 h-5' />
              </Button>
              <Button
                variant='ghost'
                size='icon'
                onClick={() =>
                  isPlaying ? pause() : play(nowPlayingContext.title)
                }
                className='w-10 h-10 rounded-full backdrop-blur-sm bg-primary/20 hover:bg-primary/30'>
                {isPlaying ? (
                  <Pause className='w-5 h-5' />
                ) : (
                  <Play className='w-5 h-5 ml-0.5' />
                )}
              </Button>
              <Button
                variant='ghost'
                size='icon'
                onClick={playNext}
                className='text-foreground hover:bg-muted'>
                <SkipForward className='w-5 h-5' />
              </Button>
            </div>

            <div className='flex items-center gap-1'>
              <Button
                variant='ghost'
                size='icon'
                onClick={toggleMute}
                className='text-secondary-foreground hover:text-foreground hover:bg-muted'>
                {isMuted || volume === 0 ? (
                  <VolumeX className='w-4 h-4' />
                ) : (
                  <Volume2 className='w-4 h-4' />
                )}
              </Button>
              <Button
                variant='ghost'
                size='icon'
                className='text-secondary-foreground hover:text-foreground hover:bg-muted'>
                <Star className='w-4 h-4' />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AudioPlayer
