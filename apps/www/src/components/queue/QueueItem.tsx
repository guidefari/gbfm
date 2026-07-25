import type { QueueTrackType } from '@gbfm/player'
import type React from 'react'
import { SharedQueueItem } from './SharedQueueItem'

interface QueueItemProps {
  track: QueueTrackType
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
