'use client'
import React, { useRef, useEffect } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy
} from '@dnd-kit/sortable'
import {
  restrictToVerticalAxis,
  restrictToParentElement
} from '@dnd-kit/modifiers'
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Shuffle,
  Repeat,
  Repeat1,
  Star,
  ChevronDown,
  MoreHorizontal
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatSeconds } from '@/lib/utils'
import { attachVolumeScroll } from '@/lib/volumeScrollHandler'
import { useAudioPlayerActions, useAudioPlayerState } from '@/store/audioPlayer'
import { SharedQueueItem } from './queue/SharedQueueItem'
import * as ScrollArea from '@radix-ui/react-scroll-area'

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
    currentIndex,
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
    reorderQueue
  } = useAudioPlayerActions()

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  )

  const volumeSliderRef = useRef<HTMLInputElement>(null)
  const volumeButtonRef = useRef<HTMLButtonElement>(null)

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      const oldIndex = queue.findIndex((track) => track.queueId === active.id)
      const newIndex = queue.findIndex((track) => track.queueId === over.id)

      reorderQueue(oldIndex, newIndex)
    }
  }

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
      className={`fixed inset-0 z-50 bg-gradient-to-br from-background via-card to-secondary text-foreground transition-transform duration-500 ease-out ${
        isFullscreenVisible ? 'translate-y-0' : 'translate-y-full'
      }`}>
      {/* Header */}
      <div className='flex justify-between items-center p-6'>
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

      <div className='flex gap-16 px-8 h-[calc(100vh-88px)]'>
        {/* Left Panel - Now Playing */}
        <div className='flex flex-col max-w-md'>
          {/* Album Artwork */}
          <div className='relative mb-8'>
            <div className='overflow-hidden mx-auto w-4/5 bg-gradient-to-br rounded-3xl shadow-2xl aspect-square from-primary/20 to-accent'>
              <img
                src={currentTrack.thumbnailUrl || '/placeholder.svg'}
                alt={currentTrack.title}
                className='object-cover w-full h-full'
              />
            </div>
          </div>

          {/* Track Info */}
          <div className='mb-8'>
            <div className='flex justify-between items-center mb-2'>
              <h1 className='pr-4 text-2xl font-semibold leading-tight'>
                {currentTrack.title}
              </h1>
              <div className='flex flex-shrink-0 gap-2 items-center'>
                <Button
                  variant='ghost'
                  size='icon'
                  className='text-muted-foreground hover:text-foreground hover:bg-muted'>
                  <Star className='w-5 h-5' />
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
          <div className='flex gap-6 justify-center items-center mb-8'>
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
                <Play className='ml-1 w-8 h-8' />
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
          <div className='flex gap-4 items-center'>
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

        {/* Right Panel - Queue */}
        <div className='flex flex-col flex-1 min-w-0'>
          <div className='flex flex-shrink-0 justify-between items-center mb-6'>
            <h2 className='text-xl font-semibold'>Up Next</h2>
          </div>

          <div className='flex-1 min-h-0'>
            <ScrollArea.Root className='h-full'>
              <ScrollArea.Viewport className='h-full'>
                {queue.length === 0 ? (
                  <div className='flex flex-col justify-center items-center p-8 h-full text-center'>
                    <div className='flex justify-center items-center mb-4 w-16 h-16 rounded-full bg-muted'>
                      <Play className='w-8 h-8 text-muted-foreground' />
                    </div>
                    <h3 className='mb-2 font-medium'>Your queue is empty</h3>
                    <p className='text-sm text-muted-foreground'>
                      Add some tracks to get started
                    </p>
                  </div>
                ) : (
                  <div className='pr-4 space-y-2'>
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={handleDragEnd}
                      modifiers={[
                        restrictToVerticalAxis,
                        restrictToParentElement
                      ]}>
                      <SortableContext
                        items={queue.map((track) => track.queueId)}
                        strategy={verticalListSortingStrategy}>
                        {queue.map((track, index) => (
                          <SharedQueueItem
                            key={track.queueId}
                            track={track}
                            index={index}
                            isCurrentTrack={index === currentIndex}
                            variant='fullscreen'
                            showDragHandle={true}
                            showContextMenu={true}
                            showRemoveButton={false}
                          />
                        ))}
                      </SortableContext>
                    </DndContext>
                  </div>
                )}
              </ScrollArea.Viewport>
              <ScrollArea.Scrollbar
                className='flex h-2 select-none touch-none'
                orientation='vertical'>
                <ScrollArea.Thumb className='flex-1 rounded-full bg-primary/50' />
              </ScrollArea.Scrollbar>
            </ScrollArea.Root>
          </div>
        </div>
      </div>
    </div>
  )
}

export default FullscreenAudioPlayer
