import {
  List,
  Maximize2,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX
} from 'lucide-react'
import { useAudioPlayerActions, useAudioPlayerState } from '@/store/audioPlayer'

export const useAudioPlayerCmdActions = (closeCmd: () => void) => {
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
  } = useAudioPlayerActions()

  const {
    isPlaying,
    volume,
    isMuted,
    isQueueVisible,
    isFullscreenVisible,
    queue,
    currentIndex
  } = useAudioPlayerState()

  const handleTogglePlayPause = () => {
    togglePlayPause()
    closeCmd()
  }

  const handleJumpForward = () => {
    jumpForward(10)
    closeCmd()
  }

  const handleJumpBackward = () => {
    jumpBackward(10)
    closeCmd()
  }

  const handleVolumeUp = () => {
    setVolume(Math.min(100, volume + 10))
    closeCmd()
  }

  const handleVolumeDown = () => {
    setVolume(Math.max(0, volume - 10))
    closeCmd()
  }

  const handleToggleMute = () => {
    toggleMute()
    closeCmd()
  }

  const handleToggleQueue = () => {
    toggleQueue()
    closeCmd()
  }

  const handleToggleFullscreen = () => {
    toggleFullscreen()
    closeCmd()
  }

  const handleCloseFullscreen = () => {
    closeFullscreen()
    closeCmd()
  }

  const handlePlayNext = () => {
    playNext()
    closeCmd()
  }

  const handlePlayPrevious = () => {
    playPrevious()
    closeCmd()
  }

  return {
    isPlaying,
    volume,
    isMuted,
    isQueueVisible,
    isFullscreenVisible,
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
      closeFullscreen: handleCloseFullscreen,
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
      Maximize2
    }
  }
}
