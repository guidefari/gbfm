'use client'

import { useNavigate, useRouterState } from '@tanstack/react-router'
import {
  ArrowDownAZ,
  ArrowUpAZ,
  Calendar,
  Headphones,
  Home,
  LockKeyhole,
  LogOut,
  Music,
  User
} from 'lucide-react'
import * as React from 'react'

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut
} from '@/components/ui/command'
import { useUIStore } from '@/store'
import { useAuthStore } from '@/store/auth'
import { useAudioPlayerState } from '@/store/audioPlayer'
import { useAudioPlayerCommandoActions } from './actions'
import { useKeyboardShortcuts } from './keyboard-shortcuts'
import { version } from '../../../../../package.json'

export function CommandDialogDemo() {
  const router = useNavigate()
  const routerState = useRouterState()
  const {
    commando,
    openCommando,
    closeCommando,
    toggleCommando,
    mixesSorting,
    setSortBy,
    toggleSortOrder
  } = useUIStore()
  const { isAuthenticated, clearAuth } = useAuthStore()
  const { audioSrc } = useAudioPlayerState()
  const audioPlayerActions = useAudioPlayerCommandoActions(closeCommando)

  const isOnMixesPage = routerState.location.pathname === '/mixes'
  const isOnHomePage = routerState.location.pathname === '/'

  const routeToMixes = React.useCallback(() => {
    router({ to: '/mixes' })
    closeCommando()
  }, [router, closeCommando])

  const routeToLogin = React.useCallback(() => {
    router({ to: '/auth/sign-in' })
    closeCommando()
  }, [router, closeCommando])

  const routeToProfile = React.useCallback(() => {
    router({ to: '/settings/profile' })
    closeCommando()
  }, [router, closeCommando])

  const routeToHome = React.useCallback(() => {
    router({ to: '/' })
    closeCommando()
  }, [router, closeCommando])

  const routeToTracks = React.useCallback(() => {
    router({ to: '/tracks' })
    closeCommando()
  }, [router, closeCommando])

  const sortByDate = React.useCallback(() => {
    setSortBy('date')
    closeCommando()
  }, [setSortBy, closeCommando])

  const sortByTitle = React.useCallback(() => {
    setSortBy('title')
    closeCommando()
  }, [setSortBy, closeCommando])

  const toggleSort = React.useCallback(() => {
    toggleSortOrder()
    closeCommando()
  }, [toggleSortOrder, closeCommando])

  const { setupKeyboardShortcuts } = useKeyboardShortcuts({
    isOnMixesPage,
    toggleSortOrder,
    routeToMixes,
    toggleCommando,
    closeCommando,
    audioSrc
  })

  // biome-ignore lint/correctness/useExhaustiveDependencies: 👀
  React.useEffect(() => {
    return setupKeyboardShortcuts()
  }, [setupKeyboardShortcuts])

  return (
    <CommandDialog
      open={commando.isOpen}
      onOpenChange={(open) => (open ? openCommando() : closeCommando())}
      title='Command palette for GBFM'>
      <CommandInput
        className='ring-0 focus-visible:ring-0 focus-visible:ring-offset-0'
        placeholder='Type a command or search...'
      />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        {audioSrc && (
          <>
            <CommandGroup heading='Playback Controls'>
              <CommandItem
                onSelect={audioPlayerActions.actions.togglePlayPause}>
                {audioPlayerActions.isPlaying ? (
                  <audioPlayerActions.icons.Pause />
                ) : (
                  <audioPlayerActions.icons.Play />
                )}
                <span>{audioPlayerActions.isPlaying ? 'Pause' : 'Play'}</span>
                <CommandShortcut>Space</CommandShortcut>
              </CommandItem>

              {audioPlayerActions.canPlayPrevious && (
                <CommandItem onSelect={audioPlayerActions.actions.playPrevious}>
                  <audioPlayerActions.icons.SkipBack />
                  <span>Previous Track</span>
                  <CommandShortcut>←</CommandShortcut>
                </CommandItem>
              )}

              {audioPlayerActions.canPlayNext && (
                <CommandItem onSelect={audioPlayerActions.actions.playNext}>
                  <audioPlayerActions.icons.SkipForward />
                  <span>Next Track</span>
                  <CommandShortcut>→</CommandShortcut>
                </CommandItem>
              )}

              <CommandItem onSelect={audioPlayerActions.actions.jumpBackward}>
                <audioPlayerActions.icons.SkipBack />
                <span>Jump Backward (10s)</span>
                <CommandShortcut>⌥←</CommandShortcut>
              </CommandItem>

              <CommandItem onSelect={audioPlayerActions.actions.jumpForward}>
                <audioPlayerActions.icons.SkipForward />
                <span>Jump Forward (10s)</span>
                <CommandShortcut>⌥→</CommandShortcut>
              </CommandItem>
            </CommandGroup>

            <CommandGroup heading='Volume Controls'>
              <CommandItem onSelect={audioPlayerActions.actions.toggleMute}>
                {audioPlayerActions.isMuted ? (
                  <audioPlayerActions.icons.VolumeX />
                ) : (
                  <audioPlayerActions.icons.Volume2 />
                )}
                <span>{audioPlayerActions.isMuted ? 'Unmute' : 'Mute'}</span>
                <CommandShortcut>M</CommandShortcut>
              </CommandItem>

              <CommandItem onSelect={audioPlayerActions.actions.volumeUp}>
                <audioPlayerActions.icons.Volume2 />
                <span>Volume Up</span>
                <CommandShortcut>⌥↑</CommandShortcut>
              </CommandItem>

              <CommandItem onSelect={audioPlayerActions.actions.volumeDown}>
                <audioPlayerActions.icons.Volume2 />
                <span>Volume Down</span>
                <CommandShortcut>⌥↓</CommandShortcut>
              </CommandItem>
            </CommandGroup>

            <CommandGroup heading='Player Controls'>
              <CommandItem onSelect={audioPlayerActions.actions.toggleQueue}>
                <audioPlayerActions.icons.List />
                <span>
                  {audioPlayerActions.isQueueVisible ? 'Hide' : 'Show'} Queue
                </span>
                <CommandShortcut>Q</CommandShortcut>
              </CommandItem>

              <CommandItem
                onSelect={audioPlayerActions.actions.toggleFullscreen}>
                <audioPlayerActions.icons.Maximize2 />
                <span>
                  {audioPlayerActions.isFullscreenVisible ? 'Exit' : 'Enter'}{' '}
                  Fullscreen
                </span>
                <CommandShortcut>F</CommandShortcut>
              </CommandItem>

              <CommandItem onSelect={audioPlayerActions.actions.toggleShuffle}>
                <audioPlayerActions.icons.Shuffle />
                <span>
                  {audioPlayerActions.isShuffled ? 'Disable' : 'Enable'} Shuffle
                </span>
                <CommandShortcut>S</CommandShortcut>
              </CommandItem>

              <CommandItem onSelect={audioPlayerActions.actions.toggleRepeat}>
                {audioPlayerActions.repeatMode === 'one' ? (
                  <audioPlayerActions.icons.Repeat1 />
                ) : (
                  <audioPlayerActions.icons.Repeat />
                )}
                <span>
                  {audioPlayerActions.repeatMode === 'none' && 'Enable Repeat'}
                  {audioPlayerActions.repeatMode === 'one' && 'Repeat One'}
                  {audioPlayerActions.repeatMode === 'all' && 'Repeat All'}
                </span>
                <CommandShortcut>R</CommandShortcut>
              </CommandItem>
            </CommandGroup>

            <CommandSeparator />
          </>
        )}

        <CommandGroup heading='Suggestions'>
          {!isOnHomePage && (
            <CommandItem onSelect={routeToHome}>
              <Home />
              <span>Home</span>
            </CommandItem>
          )}
          <CommandItem onSelect={routeToMixes}>
            <Headphones />
            <span>Mixes</span>
            <CommandShortcut>0</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={routeToTracks}>
            <Music />
            <span>All Tracks</span>
          </CommandItem>
          {!isAuthenticated && (
            <CommandItem onSelect={routeToLogin}>
              <LockKeyhole />
              <span>Login</span>
            </CommandItem>
          )}
        </CommandGroup>

        {isOnMixesPage && (
          <>
            <CommandSeparator />
            <CommandGroup heading='Sort Mixes'>
              <CommandItem onSelect={sortByDate}>
                <Calendar />
                <span>Sort by Date Created</span>
                {mixesSorting.sortBy === 'date' && (
                  <CommandShortcut>✓</CommandShortcut>
                )}
              </CommandItem>
              <CommandItem onSelect={sortByTitle}>
                <ArrowDownAZ />
                <span>Sort by Title</span>
                {mixesSorting.sortBy === 'title' && (
                  <CommandShortcut>✓</CommandShortcut>
                )}
              </CommandItem>
              <CommandItem onSelect={toggleSort}>
                {mixesSorting.sortOrder === 'asc' ? (
                  <ArrowUpAZ />
                ) : (
                  <ArrowDownAZ />
                )}
                <span>
                  Toggle Sort Order (
                  {mixesSorting.sortOrder === 'asc' ? 'A-Z' : 'Z-A'})
                </span>
                <CommandShortcut>⌥S</CommandShortcut>
              </CommandItem>
            </CommandGroup>
          </>
        )}
        <CommandSeparator />
        {isAuthenticated && (
          <CommandGroup heading='Settings'>
            <CommandItem onSelect={routeToProfile}>
              <User />
              <span>Profile</span>
              <CommandShortcut>⌘P</CommandShortcut>
            </CommandItem>

            <CommandItem onSelect={clearAuth}>
              <LogOut />
              <span>Logout</span>
              <CommandShortcut>⌘L</CommandShortcut>
            </CommandItem>
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
