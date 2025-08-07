import React from 'react'
import { SharedQueueItem } from './SharedQueueItem'

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
  fontSize?: 'sm' | 'base' | 'lg' | 'xl'
}

export const QueueItem: React.FC<QueueItemProps> = ({
  track,
  index,
  isCurrentTrack,
  fontSize = 'base'
}) => {
  return (
    <SharedQueueItem
      track={track}
      index={index}
      isCurrentTrack={isCurrentTrack}
      variant='compact'
      showRemoveButton={true}
      fontSize={fontSize}
    />
  )
}
