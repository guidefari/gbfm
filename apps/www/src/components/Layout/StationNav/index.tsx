import { Sheet, SheetClose, SheetContent, SheetTitle } from '@gbfm/ui'
import { useHotkey } from '@tanstack/react-hotkeys'
import { Link, useLocation } from '@tanstack/react-router'
import { BookOpen, Disc3, Ellipsis, House, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { cn } from '@/lib/utils'
import { useVisibility } from '@/services/player'
import { DesktopChrome } from './DesktopChrome'
import { NavAccountFooter } from './NavAccountFooter'
import { NavMenuProvider } from './nav-menu-context'
import { StationNavPanel } from './StationNavPanel'

function useActiveStationSlug() {
  const location = useLocation()
  const search: Record<string, unknown> = location.search
  const showParam = search.show
  return location.pathname === '/shows' && typeof showParam === 'string' ? showParam : undefined
}

function isPathActive(pathname: string, slug: string) {
  if (slug === '/') return pathname === '/'
  return pathname === slug || pathname.startsWith(`${slug}/`)
}

const tabClass = cn(
  'relative flex h-full min-w-0 flex-1 items-center justify-center no-underline',
  'text-muted-foreground transition-colors hover:text-foreground',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
  'aria-[current=page]:text-highlight'
)

export function StationNav() {
  const [isOpen, setIsOpen] = useState(false)
  const { isFullscreenVisible } = useVisibility()
  const location = useLocation()
  const activeStationSlug = useActiveStationSlug()
  const isDesktop = useMediaQuery('(min-width: 1024px)')

  const close = useCallback(() => setIsOpen(false), [])
  const open = useCallback(() => setIsOpen(true), [])

  useHotkey('Mod+K', () => setIsOpen((prev) => !prev))

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
  const sheetSide = isDesktop ? 'right' : 'bottom'

  return (
    <NavMenuProvider value={menuValue}>
      <DesktopChrome />

      <nav
        aria-label='Primary'
        className='fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background pb-[env(safe-area-inset-bottom)] lg:hidden'>
        <div className='grid h-11 grid-cols-4'>
          <Link
            to='/'
            aria-label='Home'
            aria-current={isPathActive(pathname, '/') ? 'page' : undefined}
            className={tabClass}>
            <House className='h-4 w-4' strokeWidth={1.75} />
          </Link>
          <Link
            to='/shows'
            aria-label='Shows'
            aria-current={isPathActive(pathname, '/shows') ? 'page' : undefined}
            className={tabClass}>
            <Disc3 className='h-4 w-4' strokeWidth={1.75} />
          </Link>
          <Link
            to='/editorial'
            aria-label='Editorial'
            aria-current={isPathActive(pathname, '/editorial') ? 'page' : undefined}
            className={tabClass}>
            <BookOpen className='h-4 w-4' strokeWidth={1.75} />
          </Link>
          <button
            type='button'
            onClick={open}
            aria-label='More'
            aria-expanded={isOpen}
            aria-current={isOpen ? 'page' : undefined}
            className={cn(tabClass, isOpen && 'text-highlight')}>
            <Ellipsis className='h-4 w-4' strokeWidth={1.75} />
          </button>
        </div>
      </nav>

      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent
          side={sheetSide}
          showClose={false}
          className={cn(
            'flex flex-col gap-0 overflow-hidden border-border p-0',
            isDesktop
              ? 'h-full w-full max-w-sm sm:max-w-sm'
              : 'h-auto max-h-[85dvh] rounded-t-lg sm:mx-auto sm:max-w-lg'
          )}>
          {!isDesktop ? (
            <div className='mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-border' />
          ) : null}
          <div className='relative flex h-12 shrink-0 items-center border-b border-border px-4 pr-14'>
            <SheetTitle className='text-sm font-black tracking-tight'>Menu</SheetTitle>
            <SheetClose className='absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring'>
              <X className='h-4 w-4' />
              <span className='sr-only'>Close</span>
            </SheetClose>
          </div>
          <div className='min-h-0 flex-1 overflow-y-auto overscroll-contain scrollbar-hide'>
            <div className='p-3'>
              <StationNavPanel activeStationSlug={activeStationSlug} onNavigate={close} />
            </div>
          </div>
          <NavAccountFooter onNavigate={close} />
        </SheetContent>
      </Sheet>
    </NavMenuProvider>
  )
}
