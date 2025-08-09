import {
  Volume2,
  VolumeX,
  Play,
  Pause,
  SkipForward,
  SkipBack,
  List,
  Maximize2,
  Shuffle,
  Repeat,
  Repeat1
} from 'lucide-react'
import { useAudioPlayerActions, useAudioPlayerState } from '@/store/audioPlayer'

export const useAudioPlayerCommandoActions = (closeCommando: () => void) => {
  const {
    togglePlayPause,
    jumpForward,
    jumpBackward,
    setVolume,
    toggleMute,
    toggleQueue,
    toggleFullscreen,
    toggleShuffle,
    toggleRepeat,
    playNext,
    playPrevious
  } = useAudioPlayerActions()

  const {
    isPlaying,
    volume,
    isMuted,
    isQueueVisible,
    isFullscreenVisible,
    repeatMode,
    isShuffled,
    queue,
    currentIndex
  } = useAudioPlayerState()

  const handleTogglePlayPause = () => {
    togglePlayPause()
    closeCommando()
  }

  const handleJumpForward = () => {
    jumpForward(10)
    closeCommando()
  }

  const handleJumpBackward = () => {
    jumpBackward(10)
    closeCommando()
  }

  const handleVolumeUp = () => {
    setVolume(Math.min(100, volume + 10))
    closeCommando()
  }

  const handleVolumeDown = () => {
    setVolume(Math.max(0, volume - 10))
    closeCommando()
  }

  const handleToggleMute = () => {
    toggleMute()
    closeCommando()
  }

  const handleToggleQueue = () => {
    toggleQueue()
    closeCommando()
  }

  const handleToggleFullscreen = () => {
    toggleFullscreen()
    closeCommando()
  }

  const handleToggleShuffle = () => {
    toggleShuffle()
    closeCommando()
  }

  const handleToggleRepeat = () => {
    toggleRepeat()
    closeCommando()
  }

  const handlePlayNext = () => {
    playNext()
    closeCommando()
  }

  const handlePlayPrevious = () => {
    playPrevious()
    closeCommando()
  }

  return {
    isPlaying,
    volume,
    isMuted,
    isQueueVisible,
    isFullscreenVisible,
    repeatMode,
    isShuffled,
    hasQueue: queue.length > 0,
    canPlayNext: currentIndex < queue.length - 1,
    canPlayPrevious: currentIndex > 0,
    actions: {
      togglePlayPause: handleTogglePlayPause,
      jumpForward: handleJumpForward,
      jumpBackward: handleJumpBackward,
      volumeUp: handleVolumeUp,
      volumeDown: handleVolumeDown,
      toggleMute: handleToggleMute,
      toggleQueue: handleToggleQueue,
      toggleFullscreen: handleToggleFullscreen,
      toggleShuffle: handleToggleShuffle,
      toggleRepeat: handleToggleRepeat,
      playNext: handlePlayNext,
      playPrevious: handlePlayPrevious
    },
    icons: {
      Play,
      Pause,
      SkipForward,
      SkipBack,
      Volume2,
      VolumeX,
      List,
      Maximize2,
      Shuffle,
      Repeat,
      Repeat1
    }
  }
}
