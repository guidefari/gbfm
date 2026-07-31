import { Link, useLocation } from '@tanstack/react-router'
import { Pause, Play } from 'lucide-react'
import { useSession } from '@/lib/auth-client'
import { cn } from '@/lib/utils'
import { useNowPlayingTrack, usePlayerActions, useProgress, useTransport } from '@/services/player'
import { MenuTrigger } from './MenuTrigger'

function AccountChip() {
  const location = useLocation()
  const { data: session } = useSession()
  const user = session?.user

  if (user) {
    return (
      <Link
        to='/dashboard'
        className='flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-sm border border-border bg-muted text-xs font-bold text-foreground no-underline'
        title={user.name}>
        {user.image ? (
          <img src={user.image} alt='' className='size-full object-cover' />
        ) : (
          (user.name?.[0] ?? '?')
        )}
      </Link>
    )
  }

  return (
    <Link
      to='/auth/sign-in'
      search={{ redirect: location.pathname }}
      className='shrink-0 text-xs font-semibold text-highlight no-underline hover:opacity-90'>
      Log in
    </Link>
  )
}

function NowPlayingChip() {
  const currentTrack = useNowPlayingTrack()
  const { isPlaying } = useTransport()
  const { toggleFullscreen, togglePlayPause } = usePlayerActions()

  if (!currentTrack) return null

  return (
    <div className='flex min-w-0 max-w-md flex-1 items-center gap-2'>
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
    <div className='absolute inset-x-0 top-0 h-px bg-border/60'>
      <div
        className='h-full bg-highlight transition-[width] duration-300 ease-linear'
        style={{ width: `${progress}%` }}
      />
    </div>
  )
}

export function DesktopChrome({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'relative hidden h-12 shrink-0 items-center gap-3 border-t border-border bg-background/95 px-4 backdrop-blur lg:flex',
        className
      )}>
      <ProgressTicker />

      <Link
        to='/'
        className='shrink-0 text-sm font-black tracking-tight text-foreground no-underline hover:text-highlight'>
        goosebumps.fm
      </Link>

      <NowPlayingChip />

      <div className='min-w-0 flex-1' />

      <div className='flex shrink-0 items-center gap-2'>
        <MenuTrigger />
        <AccountChip />
      </div>
    </div>
  )
}
