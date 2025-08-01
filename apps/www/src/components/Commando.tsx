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
import { version } from '../../../../package.json'

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

  // biome-ignore lint/correctness/useExhaustiveDependencies: 👀
  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        toggleCommando()
      }

      if (e.key === '0') {
        e.preventDefault()
        routeToMixes()
      }

      if (e.key === 's' && e.altKey && isOnMixesPage) {
        e.preventDefault()
        toggleSortOrder()
      }
    }

    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [isOnMixesPage, toggleSortOrder])

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
