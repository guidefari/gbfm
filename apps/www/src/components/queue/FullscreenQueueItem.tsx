import type { QueueTrackType } from '@gbfm/player'
import type React from 'react'
import { SharedQueueItem } from './SharedQueueItem'

interface FullscreenQueueItemProps {
  track: QueueTrackType
  index: number
  isCurrentTrack: boolean
  fontSize?: 'sm' | 'base' | 'lg' | 'xl'
}

export const FullscreenQueueItem: React.FC<FullscreenQueueItemProps> = ({
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
      variant='fullscreen'
      showDragHandle={true}
      showContextMenu={true}
      showRemoveButton={false}
      fontSize={fontSize}
    />
  )
}
