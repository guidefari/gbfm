import { Link, useLocation } from '@tanstack/react-router'
import { useSession } from '@/lib/auth-client'
import { cn } from '@/lib/utils'

const links = [
  { to: '/shows' as const, label: 'Shows' },
  { to: '/editorial' as const, label: 'Editorial' },
  { to: '/tweet' as const, label: 'Tweets' },
  { to: '/labels' as const, label: 'Labels' }
]

function isPathActive(pathname: string, slug: string) {
  return pathname === slug || pathname.startsWith(`${slug}/`)
}

const linkClass = cn(
  'px-2 py-1 text-sm font-medium tracking-tight no-underline transition-colors',
  'text-muted-foreground hover:text-foreground',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
  'aria-[current=page]:text-highlight'
)

export function DesktopTopBar({
  onOpenMenu,
  className
}: {
  onOpenMenu: () => void
  className?: string
}) {
  const pathname = useLocation().pathname
  const location = useLocation()
  const { data: session } = useSession()
  const user = session?.user

  return (
    <header
      className={cn(
        'z-40 hidden h-12 shrink-0 items-center gap-6 border-b border-border bg-background px-4 lg:flex',
        className
      )}>
      <Link
        to='/'
        className='shrink-0 text-sm font-black tracking-tight text-foreground no-underline hover:text-highlight'>
        goosebumps.fm
      </Link>

      <nav aria-label='Primary' className='flex min-w-0 flex-1 items-center gap-1'>
        {links.map((link) => (
          <Link
            key={link.to}
            to={link.to}
            aria-current={isPathActive(pathname, link.to) ? 'page' : undefined}
            className={linkClass}>
            {link.label}
          </Link>
        ))}
        <button
          type='button'
          onClick={onOpenMenu}
          className={cn(
            linkClass,
            'inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground'
          )}>
          Menu
          <kbd className='hidden rounded border border-border bg-muted/40 px-1 py-px font-mono text-[10px] text-muted-foreground xl:inline'>
            ⌘K
          </kbd>
        </button>
      </nav>

      {user ? (
        <Link
          to='/dashboard'
          className='flex shrink-0 items-center gap-2 no-underline hover:opacity-90'
          title={user.name}>
          <span className='hidden max-w-32 truncate text-sm text-muted-foreground sm:inline'>
            {user.name}
          </span>
          <span className='flex size-7 items-center justify-center overflow-hidden rounded-sm border border-border bg-muted text-xs font-bold text-foreground'>
            {user.image ? (
              <img src={user.image} alt='' className='size-full object-cover' />
            ) : (
              (user.name?.[0] ?? '?')
            )}
          </span>
        </Link>
      ) : (
        <Link
          to='/auth/sign-in'
          search={{ redirect: location.pathname }}
          className='shrink-0 text-sm font-medium text-highlight no-underline hover:opacity-90'>
          Log in
        </Link>
      )}
    </header>
  )
}
