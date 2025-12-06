'use client'
import { BaseAudioPlayer } from '@/components/common/BaseAudioPlayer'
import { useAudioPlayerActions } from '@/store/audioPlayer'

const AudioPlayer = () => {
  const { toggleFullscreen } = useAudioPlayerActions()

  return (
    <BaseAudioPlayer
      variant='full'
      showVolume={true}
      showShuffle={true}
      showRepeat={true}
      showQueue={true}
      showTrackActions={true}
      showFullscreenToggle={true}
      onFullscreenToggle={toggleFullscreen}
    />
  )
}

export default AudioPlayer
