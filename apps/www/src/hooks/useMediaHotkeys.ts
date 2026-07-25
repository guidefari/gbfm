import { useHotkey } from '@tanstack/react-hotkeys'
import {
  useActiveSource,
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

  const active = useActiveSource()
  const { isFullscreenVisible } = useVisibility()
  const { tracks, currentIndex } = useQueue()
  const { volume } = useVolume()

  const hasAudio = active._tag !== 'none'
  const hasQueue = active._tag === 'queue'
  const canPlayNext = hasQueue && currentIndex < tracks.length - 1
  const canPlayPrevious = hasQueue && currentIndex > 0

  useHotkey('Escape', () => {
    if (hasQueue && isFullscreenVisible) {
      closeFullscreen()
    }
  })

  useHotkey('Space', () => togglePlayPause(), { enabled: hasAudio })

  useHotkey('ArrowLeft', () => playPrevious(), {
    enabled: canPlayPrevious
  })

  useHotkey('ArrowRight', () => playNext(), {
    enabled: canPlayNext
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

  useHotkey('Q', () => toggleQueue(), { enabled: hasQueue })

  useHotkey('F', () => toggleFullscreen(), { enabled: hasQueue })
}
