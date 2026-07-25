'use client'
import { BaseAudioPlayer } from '@/components/common/BaseAudioPlayer'
import { usePlayerActions } from '@/services/player'

const AudioPlayer = () => {
  const { toggleFullscreen } = usePlayerActions()

  return (
    <BaseAudioPlayer
      variant='full'
      showVolume={true}
      showQueue={true}
      showTrackActions={true}
      showFullscreenToggle={true}
      onFullscreenToggle={toggleFullscreen}
    />
  )
}

export default AudioPlayer
