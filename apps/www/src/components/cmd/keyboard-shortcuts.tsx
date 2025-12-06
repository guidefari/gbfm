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

// Elements that should be ignored for keyboard shortcuts when focused
const TYPING_ELEMENTS = [
  'INPUT',
  'TEXTAREA',
  'SELECT',
  'DETAILS',
  'IFRAME' // For rich text editors and embedded content
]

// Roles that indicate typing elements
const TYPING_ROLES = [
  'textbox',
  'combobox',
  'searchbox',
  'search',
  'listbox',
  'menuitem',
  'option'
]

// Check if the current focused element is a typing element
const isTypingElement = (element: Element | null): boolean => {
  if (!element) return false

  // Check if element is a typing element by tag name
  if (TYPING_ELEMENTS.includes(element.tagName)) {
    return true
  }

  // Check if element has contenteditable attribute
  if (element.getAttribute('contenteditable') === 'true') {
    return true
  }

  // Check if element has specific roles
  const role = element.getAttribute('role')
  if (role && TYPING_ROLES.includes(role)) {
    return true
  }

  // Check if element is inside a typing element (using closest for more reliable checking)
  const selector = [
    ...TYPING_ELEMENTS.map((tag) => tag.toLowerCase()),
    '[contenteditable="true"]',
    '[contenteditable]',
    ...TYPING_ROLES.map((role) => `[role="${role}"]`)
  ].join(',')

  const parentTypingElement = element.closest(selector)
  if (parentTypingElement) {
    return true
  }

  // Additional checks for common rich text editor classes and IDs
  const isInRichTextEditor = element.closest(
    [
      '.ProseMirror',
      '.ql-editor',
      '.toastui-editor-contents',
      '.wysiwyg-editor',
      '.rich-text-editor',
      '[data-gramm_editor]',
      '[class*="editor"]',
      '[class*="rich-text"]'
    ].join(',')
  )

  if (isInRichTextEditor) {
    return true
  }

  return false
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
      // Handle Escape key specially - always close command dialog if open, regardless of focus
      if (e.key === 'Escape') {
        e.preventDefault()
        if (isCmdOpen) {
          closeCmd()
          return
        }
        if (audioSrc && audioPlayerActions.isFullscreenVisible) {
          audioPlayerActions.actions.closeFullscreen()
          return
        }
        return
      }

      // Check if user is focused on a typing element
      const activeElement = document.activeElement
      if (isTypingElement(activeElement)) {
        return
      }

      // Allow browser navigation shortcuts to pass through (only cmd/ctrl + key combinations)
      const isBrowserNavigation =
        (e.metaKey || e.ctrlKey) &&
        [
          'ArrowLeft', // cmd+left = back
          'ArrowRight', // cmd+right = forward
          'r', // cmd+r = reload
          't', // cmd+t = new tab
          'w', // cmd+w = close tab
          'l', // cmd+l = focus address bar
          'a', // cmd+a = select all
          'c', // cmd+c = copy
          'v', // cmd+v = paste
          'z', // cmd+z = undo
          'f', // cmd+f = find (conflicts with our fullscreen shortcut, but browser takes precedence)
          'n', // cmd+n = new window
          ',', // cmd+, = preferences
          '1',
          '2',
          '3',
          '4',
          '5',
          '6',
          '7',
          '8',
          '9' // cmd+1-9 = switch tabs
        ].includes(e.key)

      if (isBrowserNavigation) {
        return // Allow browser shortcuts to work normally
      }

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
