import React from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Button } from '@/components/ui/button'
import { GripVertical, Play, X } from 'lucide-react'
import { useAudioPlayerActions } from '@/store/audioPlayer'
import { cn } from '@/lib/utils'

interface QueueItemProps {
  track: {
    queueId: string
    id: string
    title: string
    url: string
    thumbnailUrl: string
    addedAt: number
  }
  index: number
  isCurrentTrack: boolean
}

export const QueueItem: React.FC<QueueItemProps> = ({
  track,
  index,
  isCurrentTrack
}) => {
  const { playFromQueue, removeFromQueue } = useAudioPlayerActions()

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: track.queueId })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition
  }

  const handlePlay = () => {
    playFromQueue(index)
  }

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation()
    removeFromQueue(track.queueId)
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer overflow-hidden w-full',
        isCurrentTrack && 'bg-primary/10 border border-primary/20',
        isDragging && 'opacity-50 shadow-lg'
      )}
      onClick={handlePlay}>
      {/* Drag Handle */}
      <button
        {...attributes}
        {...listeners}
        className='flex-shrink-0 p-1 rounded opacity-0 transition-opacity group-hover:opacity-100 hover:bg-muted cursor-grab active:cursor-grabbing'
        onClick={(e) => e.stopPropagation()}>
        <GripVertical className='w-4 h-4 text-muted-foreground' />
      </button>

      {/* Track Number */}
      <div className='flex-shrink-0 w-6 text-xs text-center text-muted-foreground'>
        {isCurrentTrack ? (
          <div className='mx-auto w-3 h-3 rounded-full animate-pulse bg-primary' />
        ) : (
          index + 1
        )}
      </div>

      {/* Album Art */}
      <img
        src={track.thumbnailUrl || '/placeholder.svg'}
        alt={track.title}
        className='object-cover flex-shrink-0 w-10 h-10 rounded'
      />

      {/* Track Info */}
      <div className='flex-1 min-w-0'>
        <h4
          className={cn(
            'font-medium text-sm truncate',
            isCurrentTrack && 'text-primary'
          )}>
          {track.title}
        </h4>
      </div>

      {/* Actions */}
      <div className='flex gap-1 items-center opacity-0 transition-opacity group-hover:opacity-100'>
        <Button
          variant='ghost'
          size='sm'
          onClick={handlePlay}
          className='p-0 w-8 h-8'>
          <Play className='w-3 h-3' />
        </Button>
        <Button
          variant='ghost'
          size='sm'
          onClick={handleRemove}
          className='p-0 w-8 h-8 hover:text-destructive'>
          <X className='w-3 h-3' />
        </Button>
      </div>
    </div>
  )
}
