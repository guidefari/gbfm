import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors
} from '@dnd-kit/core'
import { restrictToParentElement, restrictToVerticalAxis } from '@dnd-kit/modifiers'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy
} from '@dnd-kit/sortable'
import { ScrollArea, Sheet, SheetContent, SheetHeader, SheetTitle } from '@gbfm/ui'
import { Play } from 'lucide-react'
import { DEFAULT_IMAGE_URL } from '@/lib/constants'
import { useNowPlayingTrack, usePlayerActions, useQueue, useVisibility } from '@/services/player'
import { QueueItem } from './QueueItem'

export const QueueColumn = () => {
  const currentTrack = useNowPlayingTrack()
  const { tracks, currentIndex } = useQueue()
  const { isQueueVisible } = useVisibility()
  const { reorderQueue, toggleQueue } = usePlayerActions()

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      const oldIndex = tracks.findIndex((track) => track.id === active.id)
      const newIndex = tracks.findIndex((track) => track.id === over.id)

      reorderQueue(oldIndex, newIndex)
    }
  }

  return (
    <Sheet open={isQueueVisible} onOpenChange={toggleQueue}>
      <SheetContent side='right' className='w-full sm:w-80 flex flex-col overflow-hidden'>
        <SheetHeader>
          <SheetTitle>Queue</SheetTitle>
        </SheetHeader>

        <ScrollArea className='flex-1 px-2'>
          {currentTrack && (
            <div className='p-3 mb-4 border-b border-border'>
              <h3 className='mb-2 text-xs font-medium text-muted-foreground'>Now Playing</h3>
              <div className='flex items-center gap-3'>
                <img
                  src={currentTrack.thumbnailUrl || DEFAULT_IMAGE_URL}
                  alt={currentTrack.title}
                  className='shrink-0 object-cover w-12 h-12 rounded'
                />
                <h4 className='flex-1 min-w-0 text-base font-medium truncate'>
                  {currentTrack.title}
                </h4>
              </div>
            </div>
          )}

          {tracks.length === 0 ? (
            <div className='flex flex-col items-center justify-center p-8 text-center'>
              <Play className='w-8 h-8 mb-4 text-muted-foreground' />
              <h3 className='mb-2 font-medium'>Your queue is empty</h3>
              <p className='text-base text-muted-foreground'>Add some tracks to get started</p>
            </div>
          ) : (
            <div className='w-full'>
              <h3 className='mb-3 text-base font-medium text-muted-foreground'>
                Up Next ({tracks.length})
              </h3>
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
                modifiers={[restrictToVerticalAxis, restrictToParentElement]}>
                <SortableContext
                  items={tracks.map((track) => track.id)}
                  strategy={verticalListSortingStrategy}>
                  <div className='space-y-1'>
                    {tracks.map((track, index) => (
                      <QueueItem
                        key={track.id}
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
