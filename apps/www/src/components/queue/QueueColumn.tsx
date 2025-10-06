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
import { DEFAULT_IMAGE_URL } from '@/lib/constants'
import { useAudioPlayerActions, useAudioPlayerState } from '@/store/audioPlayer'
import { QueueItem } from './QueueItem'

export const QueueColumn = () => {
  const { queue, currentIndex, nowPlayingContext, thumbnailUrl } =
    useAudioPlayerState()
  const { reorderQueue } = useAudioPlayerActions()

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
    <div className='flex flex-col w-full h-full overflow-hidden border-l shadow-lg border-border bg-background'>
      <ScrollArea className='flex-1 w-full h-0'>
        {nowPlayingContext.title !== 'Nothing playing, yet' && (
          <div className='p-4 border-b border-border bg-muted/20'>
            <h3 className='mb-2 text-sm font-medium text-muted-foreground'>
              Now Playing
            </h3>
            <div className='flex items-center gap-3'>
              <img
                src={thumbnailUrl || DEFAULT_IMAGE_URL}
                alt={nowPlayingContext.title}
                className='flex-shrink-0 object-cover w-12 h-12 rounded'
              />
              <div className='flex-1'>
                <h4 className='text-sm font-medium text-white truncate'>
                  {nowPlayingContext.title}
                </h4>
              </div>
            </div>
          </div>
        )}

        {queue.length === 0 ? (
          <div className='flex flex-col items-center justify-center h-full p-8 text-center'>
            <div className='flex items-center justify-center w-16 h-16 mb-4 rounded-full bg-muted'>
              <Play className='w-8 h-8 text-muted-foreground' />
            </div>
            <h3 className='mb-2 font-medium'>Your queue is empty</h3>
            <p className='text-sm text-muted-foreground'>
              Add some tracks to get started
            </p>
          </div>
        ) : (
          <div className='w-full p-2'>
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
                      fontSize='sm'
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
