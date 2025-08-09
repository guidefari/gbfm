import { useAudioPlayerCmdActions } from './audio/actions'

interface KeyboardShortcutsProps {
  isOnMixesPage: boolean
  toggleSortOrder: () => void
  routeToMixes: () => void
  toggleCmd: () => void
  closeCmd: () => void
  audioSrc: string | null
  isCmdOpen: boolean
  whitelistedShortcuts?: string[]
}

export const useKeyboardShortcuts = ({
  isOnMixesPage,
  toggleSortOrder,
  routeToMixes,
  toggleCmd,
  closeCmd,
  audioSrc,
  isCmdOpen,
  whitelistedShortcuts = ['cmd+k']
}: KeyboardShortcutsProps) => {
  const audioPlayerActions = useAudioPlayerCmdActions(closeCmd)

  const setupKeyboardShortcuts = () => {
    const down = (e: KeyboardEvent) => {
      // Always allow cmd+k to toggle command dialog
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        toggleCmd()
        return
      }

      // If command dialog is open, only allow whitelisted shortcuts
      if (isCmdOpen && !whitelistedShortcuts.includes(e.key)) {
        return
      }

      // Only process other shortcuts when command dialog is closed
      if (e.key === '0') {
        e.preventDefault()
        routeToMixes()
      }

      if (e.key === 's' && e.altKey && isOnMixesPage) {
        e.preventDefault()
        toggleSortOrder()
      }

      // Audio player shortcuts
      if (audioSrc) {
        if (e.key === ' ') {
          e.preventDefault()
          audioPlayerActions.actions.togglePlayPause()
        }

        if (e.key === 'ArrowLeft' && e.altKey) {
          e.preventDefault()
          audioPlayerActions.actions.jumpBackward()
        }

        if (e.key === 'ArrowRight' && e.altKey) {
          e.preventDefault()
          audioPlayerActions.actions.jumpForward()
        }

        if (
          e.key === 'ArrowLeft' &&
          !e.altKey &&
          audioPlayerActions.canPlayPrevious
        ) {
          e.preventDefault()
          audioPlayerActions.actions.playPrevious()
        }

        if (
          e.key === 'ArrowRight' &&
          !e.altKey &&
          audioPlayerActions.canPlayNext
        ) {
          e.preventDefault()
          audioPlayerActions.actions.playNext()
        }

        if (e.key === 'm' || e.key === 'M') {
          e.preventDefault()
          audioPlayerActions.actions.toggleMute()
        }

        if (e.key === 'ArrowUp' && e.altKey) {
          e.preventDefault()
          audioPlayerActions.actions.volumeUp()
        }

        if (e.key === 'ArrowDown' && e.altKey) {
          e.preventDefault()
          audioPlayerActions.actions.volumeDown()
        }

        if (e.key === 'q' || e.key === 'Q') {
          e.preventDefault()
          audioPlayerActions.actions.toggleQueue()
        }

        if (e.key === 'f' || e.key === 'F') {
          e.preventDefault()
          audioPlayerActions.actions.toggleFullscreen()
        }

        if (e.key === 's' || e.key === 'S') {
          if (!e.altKey || !isOnMixesPage) {
            e.preventDefault()
            audioPlayerActions.actions.toggleShuffle()
          }
        }

        if (e.key === 'r' || e.key === 'R') {
          e.preventDefault()
          audioPlayerActions.actions.toggleRepeat()
        }
      }
    }

    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }

  return {
    setupKeyboardShortcuts,
    audioPlayerActions
  }
}
