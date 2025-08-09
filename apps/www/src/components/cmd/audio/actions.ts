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

export const useAudioPlayerCmdActions = (closeCmd: () => void) => {
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

  const handleToggleShuffle = () => {
    toggleShuffle()
    closeCmd()
  }

  const handleToggleRepeat = () => {
    toggleRepeat()
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
