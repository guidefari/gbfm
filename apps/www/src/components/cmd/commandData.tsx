import {
  Home,
  Headphones,
  Music,
  Settings,
  Upload,
  FileText,
  Mic,
  BookOpen,
  LockKeyhole,
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Volume2,
  VolumeX,
  User,
  LogOut,
  SortAsc,
  SortDesc,
  Calendar,
  LetterTextIcon,
  List,
  Maximize2,
  Shuffle,
  Repeat,
  Repeat1
} from 'lucide-react'
import { CommandItem } from './types'

export const createCommandData = (
  navigationActions: any,
  sortingActions: any,
  settingsActions: any,
  contentActions: any,
  audioPlayerCmdActions: any,
  closeCmd: () => void,
  isAuthenticated: boolean,
  isOnMixesPage: boolean,
  canEdit: boolean,
  currentArchetype?: string,
  currentId?: string,
  audioSrc?: string
): CommandItem[] => {
  const items: CommandItem[] = [
    // Direct navigation actions
    {
      id: 'home',
      label: 'Home',
      icon: Home,
      type: 'action',
      onSelect: navigationActions.routeToHome,
      requiresAuth: false
    },
    {
      id: 'words',
      label: 'Words',
      icon: BookOpen,
      type: 'action',
      onSelect: () => {
        closeCmd()
        window.location.href = '/words'
      },
      requiresAuth: false
    },
    {
      id: 'micro',
      label: 'Micro',
      icon: Mic,
      type: 'action',
      onSelect: () => {
        closeCmd()
        window.location.href = '/micro'
      },
      requiresAuth: false
    },

    // Music section with sub-items
    {
      id: 'music',
      label: 'Music',
      icon: Headphones,
      type: 'section',
      requiresAuth: false,
      items: [
        {
          id: 'mixes',
          label: 'Mixes',
          icon: Headphones,
          onSelect: navigationActions.routeToMixes,
          shortcut: '0'
        },
        {
          id: 'tracks',
          label: 'All Tracks',
          icon: Music,
          onSelect: navigationActions.routeToTracks
        }
      ]
    },

    // Upload section (auth required)
    {
      id: 'upload',
      label: 'Upload',
      icon: Upload,
      type: 'action',
      onSelect: () => {
        closeCmd()
        window.location.href = '/upload'
      },
      requiresAuth: true
    }
  ]

  // Add audio controls section if audio is playing
  if (audioSrc && audioPlayerCmdActions) {
    const {
      actions,
      isPlaying,
      isMuted,
      canPlayNext,
      canPlayPrevious,
      isQueueVisible,
      isFullscreenVisible,
      isShuffled,
      repeatMode
    } = audioPlayerCmdActions

    items.push({
      id: 'audio',
      label: 'Playback',
      icon: Volume2,
      type: 'section',
      requiresAuth: false,
      items: [
        {
          id: 'play-pause',
          label: isPlaying ? 'Pause' : 'Play',
          icon: isPlaying ? Pause : Play,
          onSelect: actions.togglePlayPause,
          shortcut: 'Space'
        },
        ...(canPlayPrevious
          ? [
              {
                id: 'previous',
                label: 'Previous Track',
                icon: SkipBack,
                onSelect: actions.playPrevious,
                shortcut: '←'
              }
            ]
          : []),
        ...(canPlayNext
          ? [
              {
                id: 'next',
                label: 'Next Track',
                icon: SkipForward,
                onSelect: actions.playNext,
                shortcut: '→'
              }
            ]
          : []),
        {
          id: 'jump-backward',
          label: 'Jump Backward (10s)',
          icon: SkipBack,
          onSelect: actions.jumpBackward,
          shortcut: '⌥←'
        },
        {
          id: 'jump-forward',
          label: 'Jump Forward (10s)',
          icon: SkipForward,
          onSelect: actions.jumpForward,
          shortcut: '⌥→'
        },
        {
          id: 'toggle-mute',
          label: isMuted ? 'Unmute' : 'Mute',
          icon: isMuted ? VolumeX : Volume2,
          onSelect: actions.toggleMute,
          shortcut: 'M'
        },
        {
          id: 'volume-up',
          label: 'Volume Up',
          icon: Volume2,
          onSelect: actions.volumeUp,
          shortcut: '⌥↑'
        },
        {
          id: 'volume-down',
          label: 'Volume Down',
          icon: Volume2,
          onSelect: actions.volumeDown,
          shortcut: '⌥↓'
        },
        {
          id: 'toggle-queue',
          label: `${isQueueVisible ? 'Hide' : 'Show'} Queue`,
          icon: List,
          onSelect: actions.toggleQueue,
          shortcut: 'Q'
        },
        {
          id: 'toggle-fullscreen',
          label: `${isFullscreenVisible ? 'Exit' : 'Enter'} Fullscreen`,
          icon: Maximize2,
          onSelect: actions.toggleFullscreen,
          shortcut: 'F'
        },
        {
          id: 'toggle-shuffle',
          label: `${isShuffled ? 'Disable' : 'Enable'} Shuffle`,
          icon: Shuffle,
          onSelect: actions.toggleShuffle,
          shortcut: 'S'
        },
        {
          id: 'toggle-repeat',
          label:
            repeatMode === 'none'
              ? 'Enable Repeat'
              : repeatMode === 'one'
                ? 'Repeat One'
                : 'Repeat All',
          icon: repeatMode === 'one' ? Repeat1 : Repeat,
          onSelect: actions.toggleRepeat,
          shortcut: 'R'
        }
      ]
    })
  }

  // Add sorting section if on mixes page
  if (isOnMixesPage) {
    items.push({
      id: 'sort',
      label: 'Sort Mixes',
      icon: SortAsc,
      type: 'section',
      requiresAuth: false,
      items: [
        {
          id: 'sort-date',
          label: 'Sort by Date',
          icon: Calendar,
          onSelect: sortingActions.sortByDate
        },
        {
          id: 'sort-title',
          label: 'Sort by Title',
          icon: LetterTextIcon,
          onSelect: sortingActions.sortByTitle
        },
        {
          id: 'toggle-sort',
          label: 'Toggle Sort Order',
          icon: SortDesc,
          onSelect: sortingActions.toggleSort
        }
      ]
    })
  }

  // Add content actions if can edit
  if (canEdit && currentArchetype && currentId) {
    items.push({
      id: 'content',
      label: 'Content Actions',
      icon: FileText,
      type: 'section',
      requiresAuth: true,
      items: [
        {
          id: 'edit-content',
          label: 'Edit Content',
          icon: FileText,
          onSelect: () =>
            contentActions.editContent(currentArchetype, currentId)
        }
      ]
    })
  }

  // Add settings section for authenticated users
  if (isAuthenticated) {
    items.push({
      id: 'settings',
      label: 'Settings',
      icon: Settings,
      type: 'section',
      requiresAuth: true,
      items: [
        {
          id: 'profile',
          label: 'Profile',
          icon: User,
          onSelect: navigationActions.routeToProfile
        },
        {
          id: 'logout',
          label: 'Logout',
          icon: LogOut,
          onSelect: settingsActions.handleLogout
        }
      ]
    })
  } else {
    // Add login action for non-authenticated users
    items.push({
      id: 'login',
      label: 'Login',
      icon: LockKeyhole,
      type: 'action',
      onSelect: navigationActions.routeToLogin,
      requiresAuth: false
    })
  }

  return items
}
