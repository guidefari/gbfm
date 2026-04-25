'use client'

import { useFeatureFlag } from '@gbfm/core/feature-flags'
import { useRouterState } from '@tanstack/react-router'
import * as React from 'react'
import { CommandDialog, CommandInput } from '@/components/ui/command'
import { useUIStore } from '@/store'
import { useAudioPlayerState } from '@/store/audioPlayer'
import { useAuthStore } from '@/store/auth'
import { version } from '../../../../../package.json'
import { useAudioPlayerCmdActions } from './audio/actions'
import { createCommandData } from './commandData'
import { useContentActions } from './content/actions'
import { useDevActions } from './dev/actions'
import { HierarchicalCommand } from './HierarchicalCommand'
import { useKeyboardShortcuts } from './keyboard-shortcuts'
import { useNavigationActions } from './navigation/actions'
import { useSettingsActions } from './settings/actions'
import { useSortingActions } from './sorting/actions'
import { useThemeActions } from './theme/actions'
import type { CommandAction, CommandItem } from './types'

export function CommandDialogDemo() {
  const [searchValue, setSearchValue] = React.useState('')
  const [isInSection, setIsInSection] = React.useState(false)
  const scrollContainerRef = React.useRef<HTMLDivElement>(null)
  const routerState = useRouterState()
  const { Cmd, openCmd, closeCmd, toggleCmd } = useUIStore()
  const { user, isAuthenticated } = useAuthStore()
  const { audioSrc } = useAudioPlayerState()
  const isQueueEnabled = useFeatureFlag('ui.queue')
  const isAdmin = user?.role === 'admin'

  const navigationActions = useNavigationActions(closeCmd)
  const sortingActions = useSortingActions(closeCmd)
  const settingsActions = useSettingsActions(closeCmd)
  const contentActions = useContentActions(closeCmd)
  const themeActions = useThemeActions(closeCmd)
  const audioPlayerCmdActions = useAudioPlayerCmdActions(closeCmd)
  const devActions = useDevActions(closeCmd)

  const isOnMixesPage = routerState.location.pathname === '/mixes'
  const pathname = routerState.location.pathname

  // Check if we're on a read page and can edit current content
  const readPageMatch = routerState.location.pathname.match(
    /^\/read\/([^/]+)\/([^/]+)$/
  )
  const currentArchetype = readPageMatch?.[1]
  const currentId = readPageMatch?.[2]

  // For now, allow editing for authenticated users on audio content
  const isAudioContent =
    currentArchetype && ['mix', 'track', 'misc'].includes(currentArchetype)
  const canEdit = isAuthenticated && Boolean(isAudioContent)

  // Create command data
  const commandItems = React.useMemo(
    () =>
      createCommandData(
        navigationActions,
        sortingActions,
        settingsActions,
        contentActions,
        audioPlayerCmdActions,
        themeActions,
        devActions,
        closeCmd,
        isAuthenticated,
        isOnMixesPage,
        canEdit,
        isAdmin,
        isQueueEnabled,
        currentArchetype,
        currentId,
        audioSrc,
        pathname
      ),
    [
      navigationActions,
      sortingActions,
      settingsActions,
      contentActions,
      audioPlayerCmdActions,
      themeActions,
      devActions,
      closeCmd,
      isAuthenticated,
      isOnMixesPage,
      canEdit,
      isAdmin,
      isQueueEnabled,
      currentArchetype,
      currentId,
      audioSrc,
      pathname
    ]
  )

  useKeyboardShortcuts({
    isOnMixesPage,
    toggleSortOrder: sortingActions.toggleSort,
    routeToMixes: navigationActions.routeToMixes,
    toggleCmd,
    closeCmd,
    audioSrc,
    isCmdOpen: Cmd.isOpen
  })

  const handleItemSelect = (item: CommandItem | CommandAction) => {
    if ('onSelect' in item) {
      item.onSelect()
    }
  }

  // Reset search and section when dialog closes
  React.useEffect(() => {
    if (!Cmd.isOpen) {
      setSearchValue('')
      setIsInSection(false)
    }
  }, [Cmd.isOpen])

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault()
    }
  }

  const handleDialogKeyDownCapture = (
    e: React.KeyboardEvent<HTMLDivElement>
  ) => {
    if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      e.stopPropagation()
      closeCmd()
    }
  }

  const handleEscapeKeyDown = (e: KeyboardEvent) => {
    if (isInSection) {
      e.preventDefault()
    }
  }

  return (
    <CommandDialog
      open={Cmd.isOpen}
      onOpenChange={(open) => (open ? openCmd() : closeCmd())}
      onEscapeKeyDown={handleEscapeKeyDown}
      title='Command palette for GBFM'>
      <CommandInput
        className='ring-0 focus-visible:ring-0 focus-visible:ring-offset-0'
        placeholder='Type a command or search...'
        value={searchValue}
        onValueChange={setSearchValue}
        onKeyDown={handleInputKeyDown}
      />

      <div
        ref={scrollContainerRef}
        className='overflow-auto max-h-96 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden'
        onKeyDownCapture={handleDialogKeyDownCapture}>
        <HierarchicalCommand
          items={commandItems}
          onItemSelect={handleItemSelect}
          isAuthenticated={isAuthenticated}
          searchValue={searchValue}
          onSearchChange={setSearchValue}
          onSectionChange={setIsInSection}
          scrollContainerRef={scrollContainerRef}
        />
      </div>

      <div className='flex items-center justify-between gap-3 p-3 border-t'>
        <div className='flex items-center gap-2 text-xs text-muted-foreground'>
          <a
            href={`https://github.com/guidefari/gbfm/releases/tag/v${version}`}
            target='_blank'
            rel='noopener noreferrer'
            className='inline-flex items-center border px-2 py-1 font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground'>
            v{version}
          </a>
        </div>
      </div>
    </CommandDialog>
  )
}
