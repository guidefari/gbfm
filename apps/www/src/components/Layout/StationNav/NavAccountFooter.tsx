import { Link, useLocation, useNavigate } from '@tanstack/react-router'
import { LayoutDashboard, LogIn, LogOut } from 'lucide-react'
import { useCallback } from 'react'
import { signOut, useSession } from '@/lib/auth-client'
import { cn } from '@/lib/utils'
import { useUIActions } from '@/store/ui'
import { navRowClass } from './NavItemLink'

const iconClass = 'h-5 w-5 shrink-0'

export function NavAccountFooter({ onNavigate }: { onNavigate?: () => void }) {
  const { data: session } = useSession()
  const location = useLocation()
  const navigate = useNavigate()
  const { resetUI } = useUIActions()
  const user = session?.user
  const isAuthenticated = Boolean(user)

  const handleSignOut = useCallback(async () => {
    onNavigate?.()
    await signOut()
    resetUI()
    navigate({ to: '/' })
  }, [onNavigate, resetUI, navigate])

  if (!isAuthenticated) {
    return (
      <div className='shrink-0 border-t border-border bg-background p-3'>
        <Link
          to='/auth/sign-in'
          search={{ redirect: location.pathname }}
          onClick={onNavigate}
          className={cn(
            navRowClass,
            'bg-highlight text-highlight-foreground hover:bg-highlight/90'
          )}>
          <LogIn className={iconClass} />
          <span className='min-w-0 flex-1 truncate'>Log in</span>
        </Link>
      </div>
    )
  }

  return (
    <div className='shrink-0 border-t border-border bg-background p-3'>
      <div className='mb-2 flex items-center gap-3 px-1'>
        <div className='flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-sm border border-border bg-muted text-base font-bold'>
          {user?.image ? (
            <img src={user.image} alt='' className='size-full object-cover' />
          ) : (
            <span>{user?.name?.[0] ?? '?'}</span>
          )}
        </div>
        <div className='min-w-0 flex-1'>
          <p className='truncate text-base font-semibold text-foreground'>{user?.name}</p>
          {user?.username ? (
            <p className='truncate text-xs text-muted-foreground'>@{user.username}</p>
          ) : null}
        </div>
      </div>

      <div className='flex flex-col gap-0.5'>
        <Link to='/dashboard' onClick={onNavigate} className={navRowClass}>
          <LayoutDashboard className={iconClass} />
          <span className='min-w-0 flex-1 truncate'>Dashboard</span>
        </Link>
        <button type='button' onClick={handleSignOut} className={navRowClass}>
          <LogOut className={iconClass} />
          <span className='min-w-0 flex-1 truncate text-left'>Log out</span>
        </button>
      </div>
    </div>
  )
}
