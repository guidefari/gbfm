import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors
} from '@dnd-kit/core'
import {
  restrictToParentElement,
  restrictToVerticalAxis
} from '@dnd-kit/modifiers'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy
} from '@dnd-kit/sortable'
import { Play } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle
} from '@/components/ui/sheet'
import { DEFAULT_IMAGE_URL } from '@/lib/constants'
import { useAudioPlayerActions, useAudioPlayerState } from '@/store/audioPlayer'
import { QueueItem } from './QueueItem'

export const QueueColumn = () => {
  const {
    queue,
    currentIndex,
    nowPlayingContext,
    thumbnailUrl,
    isQueueVisible
  } = useAudioPlayerState()
  const { reorderQueue, toggleQueue } = useAudioPlayerActions()

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

  return (
    <Sheet open={isQueueVisible} onOpenChange={toggleQueue}>
      <SheetContent
        side='right'
        className='w-full sm:w-80 flex flex-col overflow-hidden'>
        <SheetHeader>
          <SheetTitle>Queue</SheetTitle>
        </SheetHeader>

        <ScrollArea className='flex-1 px-2'>
          {nowPlayingContext.title !== 'Nothing playing, yet' && (
            <div className='p-3 mb-4 border-b border-border'>
              <h3 className='mb-2 text-xs font-medium text-muted-foreground'>
                Now Playing
              </h3>
              <div className='flex items-center gap-3'>
                <img
                  src={thumbnailUrl || DEFAULT_IMAGE_URL}
                  alt={nowPlayingContext.title}
                  className='flex-shrink-0 object-cover w-12 h-12 rounded'
                />
                <h4 className='flex-1 min-w-0 text-sm font-medium truncate'>
                  {nowPlayingContext.title}
                </h4>
              </div>
            </div>
          )}

          {queue.length === 0 ? (
            <div className='flex flex-col items-center justify-center p-8 text-center'>
              <Play className='w-8 h-8 mb-4 text-muted-foreground' />
              <h3 className='mb-2 font-medium'>Your queue is empty</h3>
              <p className='text-sm text-muted-foreground'>
                Add some tracks to get started
              </p>
            </div>
          ) : (
            <div className='w-full'>
              <h3 className='mb-3 text-sm font-medium text-muted-foreground'>
                Up Next ({queue.length})
              </h3>
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
                modifiers={[restrictToVerticalAxis, restrictToParentElement]}>
                <SortableContext
                  items={queue.map((track) => track.queueId)}
                  strategy={verticalListSortingStrategy}>
                  <div className='space-y-1'>
                    {queue.map((track, index) => (
                      <QueueItem
                        key={track.queueId}
                        track={track}
                        index={index}
                        isCurrentTrack={index === currentIndex}
                        fontSize='sm'
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}
