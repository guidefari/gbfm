import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@gbfm/ui'
import { Link, useLocation, useNavigate } from '@tanstack/react-router'
import { LayoutDashboard, LogOut, Pause, Play } from 'lucide-react'
import { useCallback } from 'react'
import { signOut, useSession } from '@/lib/auth-client'
import { cn } from '@/lib/utils'
import { useNowPlayingTrack, usePlayerActions, useProgress, useTransport } from '@/services/player'
import { useUIActions } from '@/store/ui'
import { isPathActive } from './is-path-active'
import { navItemsForSurface } from '../NavLinks'
import { useNavSections } from './useNavSections'

const desktopLinkClass = cn(
  'shrink-0 rounded-sm px-2 py-1 text-xs font-semibold tracking-wide no-underline transition-colors',
  'text-muted-foreground hover:text-foreground',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
  'aria-[current=page]:text-highlight'
)

function DesktopLinks() {
  const pathname = useLocation().pathname

  return (
    <nav aria-label='Primary' className='flex shrink-0 items-center gap-1'>
      {navItemsForSurface('desktop').map((item) =>
        item.slug ? (
          <Link
            key={item.id}
            to={item.slug}
            aria-current={isPathActive(pathname, item.slug) ? 'page' : undefined}
            className={desktopLinkClass}>
            {item.name}
          </Link>
        ) : null
      )}
    </nav>
  )
}

function AccountMenu() {
  const location = useLocation()
  const navigate = useNavigate()
  const { data: session } = useSession()
  const { resetUI } = useUIActions()
  const { create } = useNavSections()
  const user = session?.user

  const handleSignOut = useCallback(async () => {
    await signOut()
    resetUI()
    navigate({ to: '/' })
  }, [resetUI, navigate])

  if (!user) {
    return (
      <Link
        to='/auth/sign-in'
        search={{ redirect: location.pathname }}
        className='shrink-0 text-xs font-semibold text-highlight no-underline hover:opacity-90'>
        Log in
      </Link>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label='Account menu'
        className='flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-sm border border-border bg-muted text-xs font-bold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'>
        {user.image ? (
          <img src={user.image} alt='' className='size-full object-cover' />
        ) : (
          (user.name?.[0] ?? '?')
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent side='top' align='end' className='min-w-52'>
        <DropdownMenuLabel className='flex flex-col gap-0.5'>
          <span className='truncate text-base font-semibold'>{user.name}</span>
          {user.username ? (
            <span className='truncate text-xs font-normal text-muted-foreground'>
              @{user.username}
            </span>
          ) : null}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to='/dashboard' className='no-underline'>
            <LayoutDashboard className='h-4 w-4' />
            Dashboard
          </Link>
        </DropdownMenuItem>
        {create.length > 0 ? <DropdownMenuSeparator /> : null}
        {create.map((item) =>
          item.slug ? (
            <DropdownMenuItem key={item.id} asChild>
              <Link to={item.slug} className='no-underline'>
                {item.name}
              </Link>
            </DropdownMenuItem>
          ) : null
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={handleSignOut}>
          <LogOut className='h-4 w-4' />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function NowPlayingChip() {
  const currentTrack = useNowPlayingTrack()
  const { isPlaying } = useTransport()
  const { toggleFullscreen, togglePlayPause } = usePlayerActions()

  if (!currentTrack) return null

  return (
    <div className='flex min-w-0 max-w-56 shrink items-center gap-2 border-r border-border pr-3'>
      <button
        type='button'
        onClick={togglePlayPause}
        aria-label={isPlaying ? 'Pause' : 'Play'}
        className='flex size-7 shrink-0 items-center justify-center rounded-sm border border-border text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'>
        {isPlaying ? (
          <Pause className='h-3.5 w-3.5' fill='currentColor' />
        ) : (
          <Play className='h-3.5 w-3.5' fill='currentColor' />
        )}
      </button>
      <button
        type='button'
        onClick={toggleFullscreen}
        className='min-w-0 flex-1 truncate text-left text-xs font-medium text-muted-foreground no-underline transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'>
        {currentTrack.title}
      </button>
    </div>
  )
}

function ProgressTicker() {
  const currentTrack = useNowPlayingTrack()
  const { progress } = useProgress()

  if (!currentTrack) return null

  return (
    <div className='absolute inset-x-0 top-0 h-[3px] bg-border/60'>
      <div
        className='h-full bg-highlight shadow-[0_0_6px_var(--highlight)] transition-[width] duration-300 ease-linear'
        style={{ width: `${progress}%` }}
      />
    </div>
  )
}

export function DesktopChrome({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'fixed inset-x-0 bottom-0 z-40 hidden h-12 shrink-0 items-center gap-4 border-t-2 border-foreground bg-background/95 pl-4 pr-6 backdrop-blur lg:flex',
        className
      )}>
      <ProgressTicker />

      <Link
        to='/'
        className='shrink-0 text-base font-black tracking-tight text-foreground no-underline hover:text-highlight'>
        goosebumps.fm
      </Link>

      <DesktopLinks />

      <div className='min-w-0 flex-1' />

      <div className='flex shrink-0 items-center gap-3'>
        <NowPlayingChip />
        <AccountMenu />
      </div>
    </div>
  )
}
