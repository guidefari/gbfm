import { useHotkey } from '@tanstack/react-hotkeys'
import { useAudioPlayerCmdActions } from './audio/actions'

interface KeyboardShortcutsProps {
  isOnMixesPage: boolean
  toggleSortOrder: () => void
  routeToMixes: () => void
  toggleCmd: () => void
  closeCmd: () => void
  audioSrc: string | null
  isCmdOpen: boolean
}

export const useKeyboardShortcuts = ({
  isOnMixesPage,
  toggleSortOrder,
  routeToMixes,
  toggleCmd,
  closeCmd,
  audioSrc,
  isCmdOpen
}: KeyboardShortcutsProps) => {
  const audioPlayerActions = useAudioPlayerCmdActions(closeCmd)

  const hasAudio = Boolean(audioSrc)

  // Cmd/Ctrl+K — toggle command dialog (ignoreInputs: false by default for Mod combos)
  useHotkey('Mod+K', () => {
    toggleCmd()
  })

  // Escape — close command dialog or fullscreen player
  useHotkey('Escape', () => {
    if (isCmdOpen) {
      closeCmd()
    } else if (hasAudio && audioPlayerActions.isFullscreenVisible) {
      audioPlayerActions.actions.closeFullscreen()
    }
  })

  // 0 — navigate to mixes
  useHotkey(
    '0',
    () => {
      routeToMixes()
    },
    { enabled: !isCmdOpen }
  )

  // Alt+S — toggle sort order (mixes page only)
  useHotkey(
    'Alt+S',
    () => {
      toggleSortOrder()
    },
    { enabled: !isCmdOpen && isOnMixesPage }
  )

  // Space — play/pause
  useHotkey(
    'Space',
    () => {
      audioPlayerActions.actions.togglePlayPause()
    },
    { enabled: hasAudio && !isCmdOpen }
  )

  // ← / → — previous / next track
  useHotkey(
    'ArrowLeft',
    () => {
      audioPlayerActions.actions.playPrevious()
    },
    { enabled: hasAudio && !isCmdOpen && audioPlayerActions.canPlayPrevious }
  )

  useHotkey(
    'ArrowRight',
    () => {
      audioPlayerActions.actions.playNext()
    },
    { enabled: hasAudio && !isCmdOpen && audioPlayerActions.canPlayNext }
  )

  // Alt+← / Alt+→ — seek backward / forward
  useHotkey(
    'Alt+ArrowLeft',
    () => {
      audioPlayerActions.actions.jumpBackward()
    },
    { enabled: hasAudio && !isCmdOpen }
  )

  useHotkey(
    'Alt+ArrowRight',
    () => {
      audioPlayerActions.actions.jumpForward()
    },
    { enabled: hasAudio && !isCmdOpen }
  )

  // M — mute/unmute
  useHotkey(
    'M',
    () => {
      audioPlayerActions.actions.toggleMute()
    },
    { enabled: hasAudio && !isCmdOpen }
  )

  // Alt+↑ / Alt+↓ — volume up/down
  useHotkey(
    'Alt+ArrowUp',
    () => {
      audioPlayerActions.actions.volumeUp()
    },
    { enabled: hasAudio && !isCmdOpen }
  )

  useHotkey(
    'Alt+ArrowDown',
    () => {
      audioPlayerActions.actions.volumeDown()
    },
    { enabled: hasAudio && !isCmdOpen }
  )

  // Q — toggle queue
  useHotkey(
    'Q',
    () => {
      audioPlayerActions.actions.toggleQueue()
    },
    { enabled: hasAudio && !isCmdOpen }
  )

  // F — toggle fullscreen
  useHotkey(
    'F',
    () => {
      audioPlayerActions.actions.toggleFullscreen()
    },
    { enabled: hasAudio && !isCmdOpen }
  )
}
