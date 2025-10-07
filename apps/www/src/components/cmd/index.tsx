'use client'

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
  const routerState = useRouterState()
  const { Cmd, openCmd, closeCmd, toggleCmd } = useUIStore()
  const { isAuthenticated } = useAuthStore()
  const { audioSrc } = useAudioPlayerState()

  const navigationActions = useNavigationActions(closeCmd)
  const sortingActions = useSortingActions(closeCmd)
  const settingsActions = useSettingsActions(closeCmd)
  const contentActions = useContentActions(closeCmd)
  const themeActions = useThemeActions(closeCmd)
  const audioPlayerCmdActions = useAudioPlayerCmdActions(closeCmd)

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
  const canEdit = isAuthenticated && isAudioContent

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
        closeCmd,
        isAuthenticated,
        isOnMixesPage,
        canEdit,
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
      closeCmd,
      isAuthenticated,
      isOnMixesPage,
      canEdit,
      currentArchetype,
      currentId,
      audioSrc,
      pathname
    ]
  )

  const { setupKeyboardShortcuts } = useKeyboardShortcuts({
    isOnMixesPage,
    toggleSortOrder: sortingActions.toggleSort,
    routeToMixes: navigationActions.routeToMixes,
    toggleCmd,
    closeCmd,
    audioSrc,
    isCmdOpen: Cmd.isOpen,
    whitelistedShortcuts: ['cmd+k']
  })

  React.useEffect(() => {
    return setupKeyboardShortcuts()
  }, [setupKeyboardShortcuts])

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
    if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
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

      <div className='overflow-auto max-h-96'>
        <HierarchicalCommand
          items={commandItems}
          onItemSelect={handleItemSelect}
          isAuthenticated={isAuthenticated}
          searchValue={searchValue}
          onSearchChange={setSearchValue}
          onSectionChange={setIsInSection}
        />

        <div className='flex items-center justify-center p-2 border-t'>
          <a
            href={`https://github.com/guidefari/gbfm/releases/tag/v${version}`}
            target='_blank'
            rel='noopener noreferrer'
            className='text-xs transition-colors text-muted-foreground hover:text-foreground'>
            v{version}
          </a>
        </div>
      </div>
    </CommandDialog>
  )
}
