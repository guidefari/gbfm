import { useHotkey } from '@tanstack/react-hotkeys'
import {
  useNowPlayingTrack,
  usePlayerActions,
  useQueue,
  useVisibility,
  useVolume
} from '@/services/player'

export const useMediaHotkeys = () => {
  const {
    togglePlayPause,
    jumpForward,
    jumpBackward,
    setVolume,
    toggleMute,
    toggleQueue,
    toggleFullscreen,
    closeFullscreen,
    playNext,
    playPrevious
  } = usePlayerActions()

  const currentTrack = useNowPlayingTrack()
  const { isFullscreenVisible } = useVisibility()
  const { tracks, currentIndex } = useQueue()
  const { volume } = useVolume()

  const hasAudio = Boolean(currentTrack)
  const canPlayNext = currentIndex < tracks.length - 1
  const canPlayPrevious = currentIndex > 0

  useHotkey('Escape', () => {
    if (hasAudio && isFullscreenVisible) {
      closeFullscreen()
    }
  })

  useHotkey('Space', () => togglePlayPause(), { enabled: hasAudio })

  useHotkey('ArrowLeft', () => playPrevious(), {
    enabled: hasAudio && canPlayPrevious
  })

  useHotkey('ArrowRight', () => playNext(), {
    enabled: hasAudio && canPlayNext
  })

  useHotkey('Alt+ArrowLeft', () => jumpBackward(10), { enabled: hasAudio })

  useHotkey('Alt+ArrowRight', () => jumpForward(10), { enabled: hasAudio })

  useHotkey('M', () => toggleMute(), { enabled: hasAudio })

  useHotkey('Alt+ArrowUp', () => setVolume(Math.min(100, volume + 10)), {
    enabled: hasAudio
  })

  useHotkey('Alt+ArrowDown', () => setVolume(Math.max(0, volume - 10)), {
    enabled: hasAudio
  })

  useHotkey('Q', () => toggleQueue(), { enabled: hasAudio })

  useHotkey('F', () => toggleFullscreen(), { enabled: hasAudio })
}
