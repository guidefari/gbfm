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
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Trash2, Play, Repeat, Repeat1, Shuffle } from 'lucide-react'
import { useAudioPlayerActions, useAudioPlayerState } from '@/store/audioPlayer'
import { QueueItem } from './QueueItem'

export const QueueColumn = () => {
  const {
    queue,
    currentIndex,
    repeatMode,
    isShuffled,
    nowPlayingContext,
    thumbnailUrl,
    isPlaying
  } = useAudioPlayerState()
  const { reorderQueue, clearQueue, toggleRepeat, toggleShuffle } =
    useAudioPlayerActions()

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      const oldIndex = queue.findIndex((track) => track.queueId === active.id)
      const newIndex = queue.findIndex((track) => track.queueId === over.id)

      reorderQueue(oldIndex, newIndex)
    }
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

  return (
    <div className='flex overflow-hidden flex-col w-full h-full border-l shadow-lg border-border bg-background'>
      {/* Header */}
      <div className='p-4 border-b border-border'>
        <div className='flex justify-between items-center mb-2'>
          <h2 className='text-lg font-semibold'>Queue</h2>
          <div className='flex gap-1 items-center'>
            <Button
              variant='ghost'
              size='sm'
              onClick={toggleShuffle}
              className={isShuffled ? 'text-primary' : 'text-muted-foreground'}>
              <Shuffle className='w-4 h-4' />
            </Button>
            <Button
              variant='ghost'
              size='sm'
              onClick={toggleRepeat}
              className={
                repeatMode !== 'none' ? 'text-primary' : 'text-muted-foreground'
              }>
              {getRepeatIcon()}
            </Button>
            <Button
              variant='ghost'
              size='sm'
              onClick={clearQueue}
              disabled={queue.length === 0}
              className='text-muted-foreground hover:text-destructive'>
              <Trash2 className='w-4 h-4' />
            </Button>
          </div>
        </div>
      </div>

      {/* Now Playing Section */}
      {nowPlayingContext.title !== 'Nothing playing, yet' && (
        <div className='p-4 border-b border-border bg-muted/20'>
          <h3 className='mb-2 text-sm font-medium text-muted-foreground'>
            Now Playing
          </h3>
          <div className='flex gap-3 items-center'>
            <img
              src={thumbnailUrl || '/placeholder.svg'}
              alt={nowPlayingContext.title}
              className='object-cover flex-shrink-0 w-12 h-12 rounded'
            />
            <div className='flex-1'>
              <h4 className='text-sm font-medium truncate text-primary'>
                {nowPlayingContext.title}
              </h4>
              <p className='flex gap-1 items-center text-xs text-muted-foreground'>
                {isPlaying ? (
                  <>
                    <div className='w-2 h-2 bg-green-500 rounded-full animate-pulse' />
                    Playing
                  </>
                ) : (
                  <>
                    <div className='w-2 h-2 rounded-full bg-muted-foreground' />
                    Paused
                  </>
                )}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Queue List */}
      <ScrollArea className='flex-1 w-full h-0'>
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
          <div className='p-2 w-full'>
            <h3 className='px-2 mb-2 text-sm font-medium text-muted-foreground'>
              Up Next
            </h3>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
              modifiers={[restrictToVerticalAxis, restrictToParentElement]}>
              <SortableContext
                items={queue.map((track) => track.queueId)}
                strategy={verticalListSortingStrategy}>
                <div className='w-full'>
                  {queue.map((track, index) => (
                    <QueueItem
                      key={track.queueId}
                      track={track}
                      index={index}
                      isCurrentTrack={index === currentIndex}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </div>
        )}
      </ScrollArea>
    </div>
  )
}
