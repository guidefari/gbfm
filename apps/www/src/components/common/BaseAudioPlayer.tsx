'use client'
import { useFeatureFlag } from '@gbfm/core/feature-flags'
import { Button, toast } from '@gbfm/ui'
import { Link } from '@tanstack/react-router'
import {
  Heart,
  List,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX
} from 'lucide-react'
import { motion } from 'motion/react'
import type React from 'react'
import { useEffect, useRef } from 'react'
import { useAuthGuard } from '@/hooks/useAuthGuard'
import { DEFAULT_IMAGE_URL } from '@/lib/constants'
import { useAddFavorite, useFavorites, useRemoveFavorite } from '@/lib/http'
import { formatSeconds } from '@/lib/utils'
import { attachVolumeScroll } from '@/lib/volumeScrollHandler'
import {
  type Creator,
  useAudioPlayerActions,
  useAudioPlayerPlaybackState,
  useAudioPlayerProgressState,
  useAudioPlayerQueueState,
  useAudioPlayerVolumeState
} from '@/store/audioPlayer'

function CreatorLinks({ creators }: { creators?: Creator[] }) {
  if (!creators || creators.length === 0) {
    return <span>Mix</span>
  }

  return (
    <>
      {creators.map((creator, index) => (
        <span key={creator.id}>
          {creator.username ? (
            <Link
              to='/profile/$username'
              params={{ username: creator.username }}
              className='hover:underline'>
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

interface BaseAudioPlayerProps {
  variant?: 'full' | 'compact'
  showVolume?: boolean
  showQueue?: boolean
  showTrackActions?: boolean
  showFullscreenToggle?: boolean
  className?: string
  onFullscreenToggle?: () => void
}

export function BaseAudioPlayer({
  variant = 'full',
  showVolume = true,
  showQueue = true,
  showTrackActions = true,
  showFullscreenToggle = true,
  className = '',
  onFullscreenToggle
}: BaseAudioPlayerProps) {
  const isQueueEnabled = useFeatureFlag('ui.queue')
  const shouldShowQueue = showQueue && isQueueEnabled

  const {
    audioSrc,
    isPlaying,
    thumbnailUrl,
    nowPlayingContext,
    currentTrackId
  } = useAudioPlayerPlaybackState()
  const { queue } = useAudioPlayerQueueState()
  const { progress, currentTime, duration } = useAudioPlayerProgressState()
  const { volume, isMuted } = useAudioPlayerVolumeState()

  const { requireAuth } = useAuthGuard('mix')

  // Favourites
  const { data: favorites } = useFavorites()
  const { addFavorite } = useAddFavorite()
  const { removeFavorite } = useRemoveFavorite()
  const isFavorited = currentTrackId
    ? favorites.some((f) => f.audioId === currentTrackId)
    : false

  const {
    play,
    pause,
    playNext,
    playPrevious,
    setTimeUsingPercentage,
    setVolume,
    toggleMute,
    toggleQueue
  } = useAudioPlayerActions()

  const volumeSliderRef = useRef<HTMLInputElement>(null)
  const volumeButtonRef = useRef<HTMLButtonElement>(null)

  // Volume scroll handling
  useEffect(() => {
    if (!showVolume) return

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
  }, [volume, isMuted, setVolume, showVolume])

  const handleProgressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTimeUsingPercentage(Number(e.target.value))
  }

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setVolume(Number(e.target.value))
  }

  const performFavoriteAction = async () => {
    if (!currentTrackId) {
      toast({
        title: 'No track playing',
        description: 'Play a track from the library to add it to favorites'
      })
      return
    }

    try {
      if (isFavorited) {
        await removeFavorite({ audioId: currentTrackId })
        toast({
          title: 'Removed from favorites',
          description: 'Track removed from your favorites'
        })
      } else {
        await addFavorite({ audioId: currentTrackId })
        toast({
          title: 'Added to favorites',
          description: 'Track added to your favorites'
        })
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to update favorites',
        variant: 'destructive'
      })
    }
  }

  const handleToggleFavorite = () => {
    requireAuth(() => performFavoriteAction())
  }

  // Create a current track object from the existing state
  const currentTrack = audioSrc
    ? {
        title: nowPlayingContext.title,
        thumbnailUrl: thumbnailUrl,
        creators: nowPlayingContext.creators,
        slug: nowPlayingContext.slug
      }
    : null

  if (!currentTrack) {
    if (variant === 'compact') {
      return (
        <div className='flex flex-col items-center justify-center h-32 text-center'>
          <div className='flex items-center justify-center w-12 h-12 mb-2 rounded-sm bg-muted'>
            <Play className='w-6 h-6 text-muted-foreground' />
          </div>
          <p className='text-sm text-muted-foreground'>No track playing</p>
        </div>
      )
    }
    return (
      <div
        className={`shrink-0 border-t border-transparent min-h-[104px] ${className}`}
      />
    )
  }

  if (variant === 'compact') {
    return (
      <div className={`space-y-4 ${className}`}>
        <h2 className='text-lg font-bold'>Now Playing</h2>

        {/* Track Info */}
        <div className='flex items-center gap-3'>
          <img
            src={currentTrack.thumbnailUrl || DEFAULT_IMAGE_URL}
            alt={currentTrack.title}
            className='object-cover w-12 h-12 rounded'
          />
          <div className='flex-1 min-w-0'>
            <h3 className='text-sm font-medium truncate'>
              {currentTrack.slug ? (
                <Link
                  to='/mixes/$mixId'
                  params={{ mixId: currentTrack.slug }}
                  className='hover:underline'>
                  {currentTrack.title}
                </Link>
              ) : (
                currentTrack.title
              )}
            </h3>
            <p className='text-xs text-muted-foreground'>
              <CreatorLinks creators={currentTrack.creators} />
            </p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className='space-y-2'>
          <input
            type='range'
            value={progress}
            onChange={handleProgressChange}
            max={100}
            step={0.1}
            className='w-full h-2 bg-muted rounded-sm appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-sm [&::-webkit-slider-thumb]:bg-primary'
          />
          <div className='flex justify-between text-xs text-muted-foreground'>
            <span>{formatSeconds(currentTime)}</span>
            <span>{formatSeconds(duration)}</span>
          </div>
        </div>

        {/* Controls */}
        <div className='flex items-center justify-center gap-2'>
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
            onClick={() =>
              isPlaying ? pause() : play(nowPlayingContext.title)
            }
            className='text-foreground hover:bg-muted'>
            {isPlaying ? (
              <Pause className='w-4 h-4' />
            ) : (
              <Play className='w-4 h-4' />
            )}
          </Button>
          <Button
            variant='ghost'
            size='icon'
            onClick={playNext}
            className='text-foreground hover:bg-muted'>
            <SkipForward className='w-4 h-4' />
          </Button>
        </div>
      </div>
    )
  }

  // Full variant (desktop layout)
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className={`shrink-0 border-t backdrop-blur-md bg-background/95 border-border min-h-[104px] ${className}`}>
      <div className='px-4 py-3 mx-auto max-w-(--breakpoint-2xl)'>
        {/* Desktop Layout */}
        <div className='hidden md:grid md:grid-cols-3 md:items-center md:gap-4'>
          {/* Left: Track Info */}
          <div className='flex items-center min-w-0 gap-3'>
            {showFullscreenToggle && (
              <button
                type='button'
                onClick={onFullscreenToggle}
                className='shrink-0 p-0 bg-transparent border-0'>
                <img
                  src={currentTrack.thumbnailUrl || DEFAULT_IMAGE_URL}
                  alt={currentTrack.title}
                  className='object-cover transition-opacity rounded-sm w-14 h-14 hover:opacity-80'
                />
              </button>
            )}
            <div className='flex-1 min-w-0'>
              <h3 className='text-sm font-medium truncate'>
                {currentTrack.slug ? (
                  <Link
                    to='/mixes/$mixId'
                    params={{ mixId: currentTrack.slug }}
                    className='hover:underline'>
                    {currentTrack.title}
                  </Link>
                ) : (
                  currentTrack.title
                )}
              </h3>
              <p className='px-0 text-xs truncate text-secondary-foreground'>
                <CreatorLinks creators={currentTrack.creators} />
              </p>
            </div>
            {showTrackActions && (
              <div className='flex items-center shrink-0 gap-2'>
                <Button
                  variant='ghost'
                  size='icon'
                  onClick={handleToggleFavorite}
                  className={`text-secondary-foreground hover:text-foreground hover:bg-muted ${isFavorited ? 'text-red-500' : ''}`}>
                  <Heart
                    className={`w-4 h-4 ${isFavorited ? 'fill-current' : ''}`}
                  />
                </Button>
              </div>
            )}
          </div>

          {/* Center: Controls & Progress */}
          <div className='flex flex-col items-center gap-2'>
            <div className='flex items-center gap-2'>
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
                className='w-8 h-8 rounded-sm backdrop-blur-sm bg-primary/20 hover:bg-primary/30'
                onClick={() =>
                  isPlaying ? pause() : play(nowPlayingContext.title)
                }>
                {isPlaying ? (
                  <Pause className='w-4 h-4' />
                ) : (
                  <Play className='w-4 h-4' />
                )}
              </Button>
              <Button
                variant='ghost'
                size='icon'
                onClick={playNext}
                className='text-foreground hover:bg-muted'>
                <SkipForward className='w-4 h-4' />
              </Button>
            </div>

            <div className='flex items-center w-full max-w-md gap-2'>
              <span className='text-xs text-secondary-foreground min-w-10 text-right'>
                {formatSeconds(currentTime)}
              </span>
              <input
                type='range'
                value={progress}
                onChange={handleProgressChange}
                max={100}
                step={0.1}
                className='flex-1 h-2 bg-muted rounded-sm appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-sm [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow-lg'
              />
              <span className='text-xs text-secondary-foreground min-w-10'>
                {formatSeconds(duration)}
              </span>
            </div>
          </div>

          {/* Right: Volume & Queue */}
          <div className='flex items-center justify-end gap-2'>
            {showVolume && (
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
                  className='w-20 h-2 bg-muted rounded-sm appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-sm [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow-lg'
                  title={`Volume: ${volume}% (scroll to adjust)`}
                />
              </div>
            )}

            {shouldShowQueue && (
              <Button
                variant='ghost'
                size='icon'
                onClick={toggleQueue}
                className={`${queue.length > 0 ? 'relative' : ''} text-secondary-foreground hover:text-foreground hover:bg-muted`}>
                <List className='w-4 h-4' />
                {queue.length > 0 && (
                  <span className='absolute flex items-center justify-center w-5 h-5 text-xs rounded-sm -top-1 -right-1 bg-primary text-primary-foreground'>
                    {queue.length}
                  </span>
                )}
              </Button>
            )}
          </div>
        </div>

        {/* Mobile Layout */}
        <div className='md:hidden'>
          <div className='flex items-center gap-3 mb-3'>
            {showFullscreenToggle && (
              <button
                type='button'
                onClick={onFullscreenToggle}
                className='shrink-0 p-0 bg-transparent border-0'>
                <img
                  src={currentTrack.thumbnailUrl || DEFAULT_IMAGE_URL}
                  alt={currentTrack.title}
                  className='object-cover w-12 h-12 transition-opacity rounded-sm hover:opacity-80'
                />
              </button>
            )}
            <div className='flex-1 min-w-0'>
              <h3 className='text-sm font-medium truncate'>
                {currentTrack.slug ? (
                  <Link
                    to='/mixes/$mixId'
                    params={{ mixId: currentTrack.slug }}
                    className='hover:underline'>
                    {currentTrack.title}
                  </Link>
                ) : (
                  currentTrack.title
                )}
              </h3>
              <p className='text-xs truncate text-secondary-foreground'>
                <CreatorLinks creators={currentTrack.creators} />
              </p>
            </div>
            {shouldShowQueue && (
              <Button
                variant='ghost'
                size='icon'
                onClick={toggleQueue}
                className={`${queue.length > 0 ? 'relative' : ''} text-secondary-foreground hover:text-foreground hover:bg-muted`}>
                <List className='w-4 h-4' />
                {queue.length > 0 && (
                  <span className='absolute flex items-center justify-center w-5 h-5 text-xs rounded-sm -top-1 -right-1 bg-primary text-primary-foreground'>
                    {queue.length}
                  </span>
                )}
              </Button>
            )}
          </div>

          <div className='flex items-center gap-2 mb-2'>
            <span className='text-xs text-secondary-foreground min-w-10 text-right'>
              {formatSeconds(currentTime)}
            </span>
            <input
              type='range'
              value={progress}
              onChange={handleProgressChange}
              max={100}
              step={0.1}
              className='flex-1 h-2 bg-muted rounded-sm appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-sm [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow-lg'
            />
            <span className='text-xs text-secondary-foreground min-w-10'>
              {formatSeconds(duration)}
            </span>
          </div>

          <div className='flex items-center justify-between'>
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
                className='w-10 h-10 rounded-sm backdrop-blur-sm bg-primary/20 hover:bg-primary/30'>
                {isPlaying ? (
                  <Pause className='w-5 h-5' />
                ) : (
                  <Play className='w-5 h-5' />
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
              {showVolume && (
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
              )}
              {showTrackActions && (
                <Button
                  variant='ghost'
                  size='icon'
                  onClick={handleToggleFavorite}
                  className={`text-secondary-foreground hover:text-foreground hover:bg-muted ${isFavorited ? 'text-red-500' : ''}`}>
                  <Heart
                    className={`w-4 h-4 ${isFavorited ? 'fill-current' : ''}`}
                  />
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
