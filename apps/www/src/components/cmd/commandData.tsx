import {
  Calendar,
  Disc3,
  FileText,
  Home,
  LetterTextIcon,
  List,
  LockKeyhole,
  LogOut,
  Maximize2,
  Monitor,
  Moon,
  Pause,
  Play,
  Radio,
  Rocket,
  RotateCcw,
  Settings,
  Shield,
  SkipBack,
  SkipForward,
  SortAsc,
  SortDesc,
  Sun,
  Trash2,
  Upload,
  Volume2,
  VolumeX,
  Wrench
} from 'lucide-react'
import { env } from '@/env'
import type { CommandItem } from './types'

export const createCommandData = (
  navigationActions: Record<string, () => void>,
  sortingActions: Record<string, () => void>,
  settingsActions: Record<string, () => void>,
  contentActions: { editContent: (archetype: string, id: string) => void },
  audioPlayerCmdActions: ReturnType<
    typeof import('./audio/actions').useAudioPlayerCmdActions
  >,
  themeActions: { cycleTheme: () => void; currentTheme: string },
  devActions: {
    resetUIState: () => void
    resetAudioPlayer: () => void
    resetAll: () => void
    runAnalyticsExample: () => void
  },
  _closeCmd: () => void,
  isAuthenticated: boolean,
  isOnMixesPage: boolean,
  canEdit: boolean,
  isAdmin: boolean,
  isQueueEnabled: boolean,
  currentArchetype?: string,
  currentId?: string,
  audioSrc?: string | null,
  pathname?: string
): CommandItem[] => {
  const getThemeIcon = () => {
    switch (themeActions.currentTheme) {
      case 'light':
        return Sun
      case 'dark':
        return Moon
      case 'system':
        return Monitor
      default:
        return Monitor
    }
  }

  const getThemeLabel = () => {
    switch (themeActions.currentTheme) {
      case 'light':
        return 'Theme: Light'
      case 'dark':
        return 'Theme: Dark'
      case 'system':
        return 'Theme: System'
      default:
        return 'Toggle Theme'
    }
  }

  const items: (CommandItem | null)[] = [
    // Direct navigation actions
    pathname !== '/'
      ? {
          id: 'home',
          label: 'Home',
          icon: Home,
          type: 'action',
          onSelect: navigationActions.routeToHome,
          requiresAuth: false
        }
      : null,
    {
      id: 'theme-toggle',
      label: getThemeLabel(),
      icon: getThemeIcon(),
      type: 'action',
      onSelect: themeActions.cycleTheme,
      requiresAuth: false
    },
    // {
    //   id: 'words',
    //   label: 'Words',
    //   icon: BookOpen,
    //   type: 'action',
    //   onSelect: () => {
    //     closeCmd()
    //     window.location.href = '/words'
    //   },
    //   requiresAuth: false
    // },
    // {
    //   id: 'micro',
    //   label: 'Micro',
    //   icon: Mic,
    //   type: 'action',
    //   onSelect: () => {
    //     closeCmd()
    //     window.location.href = '/micro'
    //   },
    //   requiresAuth: false
    // },

    // Music section with sub-items
    // {
    //   id: 'music',
    //   label: 'Explore Music',
    //   icon: Headphones,
    //   type: 'section',
    //   requiresAuth: false,
    //   items: [
    //     {
    //       id: 'mixes',
    //       label: 'Mixes',
    //       icon: Headphones,
    //       onSelect: navigationActions.routeToMixes,
    //       shortcut: '0'
    //     },
    //     {
    //       id: 'tracks',
    //       label: 'All Tracks',
    //       icon: Music,
    //       onSelect: navigationActions.routeToTracks
    //     }
    //     // {
    //     //   id: 'labels',
    //     //   label: 'Record Labels',
    //     //   icon: Music,
    //     //   onSelect: navigationActions.routeToLabels
    //     // }
    //   ]
    // }
    {
      id: 'mixes',
      label: 'Mixes',
      icon: Disc3,
      type: 'action',
      onSelect: navigationActions.routeToMixes
    },
    {
      id: 'shows',
      label: 'Radio Shows',
      icon: Radio,
      type: 'action',
      onSelect: navigationActions.routeToShows
    },
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: List,
      type: 'action',
      onSelect: navigationActions.routeToDashboard,
      requiresAuth: true
    },
    {
      id: 'reminders',
      label: 'Music Reminders',
      icon: Calendar,
      type: 'action',
      onSelect: navigationActions.routeToReminders,
      requiresAuth: true
    },

    // Upload section (auth required)
    {
      id: 'upload',
      label: 'Upload Mix',
      icon: Upload,
      type: 'action',
      onSelect: navigationActions.routeToUpload,
      requiresAuth: true
    },

    // Upload label section (admin required)
    {
      id: 'upload-label',
      label: 'Upload Label',
      icon: FileText,
      type: 'action',
      onSelect: navigationActions.routeToLabelUpload,
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
      isFullscreenVisible
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
        ...(isQueueEnabled
          ? [
              {
                id: 'toggle-queue',
                label: `${isQueueVisible ? 'Hide' : 'Show'} Queue`,
                icon: List,
                onSelect: actions.toggleQueue,
                shortcut: 'Q'
              }
            ]
          : []),
        {
          id: 'toggle-fullscreen',
          label: `${isFullscreenVisible ? 'Exit' : 'Enter'} Fullscreen`,
          icon: Maximize2,
          onSelect: actions.toggleFullscreen,
          shortcut: 'F'
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
    const settingsItems = [
      {
        id: 'settings',
        label: 'Settings',
        icon: Settings,
        onSelect: navigationActions.routeToSettings
      }
    ]

    // Add admin option for admin users
    if (isAdmin) {
      settingsItems.unshift({
        id: 'admin',
        label: 'Admin Dashboard',
        icon: Shield,
        onSelect: navigationActions.routeToAdmin
      })
    }

    settingsItems.push({
      id: 'logout',
      label: 'Logout',
      icon: LogOut,
      onSelect: settingsActions.handleLogout
    })

    items.push({
      id: 'settings',
      label: 'Settings',
      icon: Settings,
      type: 'section',
      requiresAuth: true,
      items: settingsItems
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

  // Add dev tools in development mode only
  if (env.isDev) {
    items.push({
      id: 'dev-tools',
      label: 'Dev Tools',
      icon: Wrench,
      type: 'section',
      requiresAuth: false,
      items: [
        {
          id: 'analytics-example',
          label: 'Analytics Example Button',
          icon: Rocket,
          onSelect: devActions.runAnalyticsExample
        },
        {
          id: 'reset-ui',
          label: 'Reset UI State',
          icon: RotateCcw,
          onSelect: devActions.resetUIState
        },
        {
          id: 'reset-audio',
          label: 'Reset Audio Player',
          icon: RotateCcw,
          onSelect: devActions.resetAudioPlayer
        },
        {
          id: 'reset-all',
          label: 'Reset Everything',
          icon: Trash2,
          onSelect: devActions.resetAll
        }
      ]
    })
  }

  return items.filter((item): item is CommandItem => item !== null)
}
