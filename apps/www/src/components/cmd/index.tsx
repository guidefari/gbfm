'use client'

import { useRouterState } from '@tanstack/react-router'
import * as React from 'react'

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandList,
  CommandSeparator
} from '@/components/ui/command'
import { useUIStore } from '@/store'
import { useAuthStore } from '@/store/auth'
import { useAudioPlayerState } from '@/store/audioPlayer'
import { NavigationCommands } from './navigation/commands'
import { useNavigationActions } from './navigation/actions'
import { AudioCommands } from './audio/commands'
import { SortingCommands } from './sorting/commands'
import { useSortingActions } from './sorting/actions'
import { SettingsCommands } from './settings/commands'
import { useSettingsActions } from './settings/actions'
import { useKeyboardShortcuts } from './keyboard-shortcuts'
import { version } from '../../../../../package.json'

export function CommandDialogDemo() {
  const routerState = useRouterState()
  const { Cmd, openCmd, closeCmd, toggleCmd, mixesSorting } = useUIStore()
  const { isAuthenticated } = useAuthStore()
  const { audioSrc } = useAudioPlayerState()

  const navigationActions = useNavigationActions(closeCmd)
  const sortingActions = useSortingActions(closeCmd)
  const settingsActions = useSettingsActions(closeCmd)

  const isOnMixesPage = routerState.location.pathname === '/mixes'
  const isOnHomePage = routerState.location.pathname === '/'

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

  // biome-ignore lint/correctness/useExhaustiveDependencies: 👀
  React.useEffect(() => {
    return setupKeyboardShortcuts()
  }, [setupKeyboardShortcuts])

  return (
    <CommandDialog
      open={Cmd.isOpen}
      onOpenChange={(open) => (open ? openCmd() : closeCmd())}
      title='Command palette for GBFM'>
      <CommandInput
        className='ring-0 focus-visible:ring-0 focus-visible:ring-offset-0'
        placeholder='Type a command or search...'
      />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        {audioSrc && (
          <>
            <AudioCommands closeCmd={closeCmd} />
            <CommandSeparator />
          </>
        )}

        <CommandGroup heading='Suggestions'>
          <NavigationCommands
            isOnHomePage={isOnHomePage}
            isAuthenticated={isAuthenticated}
            onNavigateHome={navigationActions.routeToHome}
            onNavigateToMixes={navigationActions.routeToMixes}
            onNavigateToTracks={navigationActions.routeToTracks}
            onNavigateToLogin={navigationActions.routeToLogin}
          />
        </CommandGroup>

        {isOnMixesPage && (
          <>
            <CommandSeparator />
            <CommandGroup heading='Sort Mixes'>
              <SortingCommands
                sortBy={mixesSorting.sortBy}
                sortOrder={mixesSorting.sortOrder}
                onSortByDate={sortingActions.sortByDate}
                onSortByTitle={sortingActions.sortByTitle}
                onToggleSortOrder={sortingActions.toggleSort}
              />
            </CommandGroup>
          </>
        )}
        <CommandSeparator />
        {isAuthenticated && (
          <CommandGroup heading='Settings'>
            <SettingsCommands
              onNavigateToProfile={navigationActions.routeToProfile}
              onLogout={settingsActions.handleLogout}
            />
          </CommandGroup>
        )}
      </CommandList>
      <div className='flex justify-center items-center p-2 border-t'>
        <a
          href={`https://github.com/guidefari/gbfm/releases/tag/v${version}`}
          target='_blank'
          rel='noopener noreferrer'
          className='text-xs transition-colors text-muted-foreground hover:text-foreground'>
          v{version}
        </a>
      </div>
    </CommandDialog>
  )
}
