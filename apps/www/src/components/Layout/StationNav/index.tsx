import { Sheet, SheetClose, SheetContent, SheetTitle } from '@gbfm/ui'
import { Link, useLocation } from '@tanstack/react-router'
import { BookOpen, Disc3, Menu, Pause, Play, Search, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { GlobalSearchDialog } from '@/components/GlobalSearchDialog'
import { DEFAULT_IMAGE_URL } from '@/lib/constants'
import { cn } from '@/lib/utils'
import {
  useNowPlayingTrack,
  usePlayerActions,
  useTransport,
  useVisibility
} from '@/services/player'
import { DesktopChrome } from './DesktopChrome'
import { isPathActive } from './is-path-active'
import { NavAccountFooter } from './NavAccountFooter'
import { NavMenuProvider } from './nav-menu-context'
import { StationNavPanel } from './StationNavPanel'

const tabClass = cn(
  'relative flex h-full min-w-0 flex-1 items-center justify-center no-underline',
  'text-muted-foreground transition-colors hover:text-foreground',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
  'aria-[current=page]:text-highlight'
)

function PlayerTab() {
  const currentTrack = useNowPlayingTrack()
  const { isPlaying } = useTransport()
  const { toggleFullscreen } = usePlayerActions()

  if (!currentTrack) {
    return (
      <Link to='/shows' aria-label='Now playing' className={tabClass}>
        <Disc3 className='h-5 w-5' strokeWidth={1.75} />
      </Link>
    )
  }

  return (
    <button
      type='button'
      onClick={toggleFullscreen}
      aria-label='Now playing'
      className={cn(tabClass, 'text-foreground')}>
      <span className='relative flex size-6 shrink-0 items-center justify-center overflow-hidden rounded-sm border border-border'>
        <img
          src={currentTrack.thumbnailUrl || DEFAULT_IMAGE_URL}
          alt=''
          className='size-full object-cover'
        />
        <span className='absolute inset-0 flex items-center justify-center bg-background/40'>
          {isPlaying ? (
            <Pause className='h-3 w-3 text-white' fill='currentColor' />
          ) : (
            <Play className='h-3 w-3 text-white' fill='currentColor' />
          )}
        </span>
      </span>
    </button>
  )
}

export function StationNav() {
  const [isOpen, setIsOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const { isFullscreenVisible } = useVisibility()
  const location = useLocation()

  const close = useCallback(() => setIsOpen(false), [])
  const open = useCallback(() => setIsOpen(true), [])

  useEffect(() => {
    close()
  }, [close, location.href])

  const menuValue = useMemo(
    () => ({
      openMenu: open,
      isMenuOpen: isOpen
    }),
    [open, isOpen]
  )

  if (isFullscreenVisible) return null

  const pathname = location.pathname

  return (
    <NavMenuProvider value={menuValue}>
      <DesktopChrome />

      <nav
        aria-label='Primary'
        className='fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background pb-[env(safe-area-inset-bottom)] lg:hidden'>
        <div className='grid h-11 grid-cols-5'>
          <PlayerTab />
          <Link
            to='/shows'
            aria-label='Shows'
            aria-current={isPathActive(pathname, '/shows') ? 'page' : undefined}
            className={tabClass}>
            <Disc3 className='h-5 w-5' strokeWidth={1.75} />
          </Link>
          <Link
            to='/editorial'
            aria-label='Editorial'
            aria-current={isPathActive(pathname, '/editorial') ? 'page' : undefined}
            className={tabClass}>
            <BookOpen className='h-5 w-5' strokeWidth={1.75} />
          </Link>
          <button
            type='button'
            onClick={() => setSearchOpen(true)}
            aria-label='Search'
            className={tabClass}>
            <Search className='h-5 w-5' strokeWidth={1.75} />
          </button>
          <button
            type='button'
            onClick={open}
            aria-label='Menu'
            aria-expanded={isOpen}
            aria-current={isOpen ? 'page' : undefined}
            className={cn(tabClass, isOpen && 'text-highlight')}>
            <Menu className='h-5 w-5' strokeWidth={1.75} />
          </button>
        </div>
      </nav>

      <GlobalSearchDialog open={searchOpen} onOpenChange={setSearchOpen} />

      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent
          side='bottom'
          showClose={false}
          className={cn(
            'flex flex-col gap-0 overflow-hidden border-border p-0 lg:hidden',
            'h-auto max-h-[85dvh] rounded-t-lg sm:mx-auto sm:max-w-lg'
          )}>
          <div className='mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-border' />
          <div className='relative flex h-12 shrink-0 items-center border-b border-border px-4 pr-14'>
            <SheetTitle className='text-base font-black tracking-tight'>Menu</SheetTitle>
            <SheetClose className='absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring'>
              <X className='h-4 w-4' />
              <span className='sr-only'>Close</span>
            </SheetClose>
          </div>
          <div className='min-h-0 flex-1 overflow-y-auto overscroll-contain scrollbar-hide'>
            <div className='p-3'>
              <StationNavPanel onNavigate={close} />
            </div>
          </div>
          <NavAccountFooter onNavigate={close} />
        </SheetContent>
      </Sheet>
    </NavMenuProvider>
  )
}
