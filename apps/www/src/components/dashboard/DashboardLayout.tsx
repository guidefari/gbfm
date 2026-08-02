import { canCreatePosts } from '@gbfm/core/roles'
import { Link, type LinkProps, useLocation } from '@tanstack/react-router'
import { FileText, Home, Link2, Mail, Music, Palette, User as UserIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { useSession } from '@/lib/auth-client'

type DashboardTab = {
  to: LinkProps['to']
  label: string
  icon: typeof Home
  requiresPostCreate?: boolean
}

const tabs: DashboardTab[] = [
  { to: '/dashboard', label: 'Home', icon: Home },
  { to: '/dashboard/content', label: 'Content', icon: FileText, requiresPostCreate: true },
  { to: '/dashboard/profile', label: 'Profile', icon: UserIcon },
  { to: '/dashboard/appearance', label: 'Appearance', icon: Palette },
  { to: '/dashboard/player', label: 'Player', icon: Music },
  { to: '/dashboard/integrations', label: 'Integrations', icon: Link2 },
  { to: '/dashboard/email', label: 'Email', icon: Mail }
]

function DashboardTabs({ role }: { role: string | null | undefined }) {
  const pathname = useLocation().pathname
  const visibleTabs = tabs.filter((tab) => !tab.requiresPostCreate || canCreatePosts(role))

  return (
    <nav
      aria-label='Dashboard'
      className='-mx-4 flex gap-1 overflow-x-auto border-b border-border/60 px-4 pb-px sm:mx-0 sm:px-0'>
      {visibleTabs.map(({ to, label, icon: Icon }) => {
        const isActive = pathname === to

        return (
          <Link
            key={to}
            to={to}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-base font-medium transition-colors',
              isActive
                ? 'border-highlight text-highlight'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}>
            <Icon className='h-4 w-4' />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}

export function DashboardLayout({
  title,
  description,
  actions,
  children
}: {
  title: string
  description?: string
  actions?: ReactNode
  children: ReactNode
}) {
  const { data: session, isPending } = useSession()

  if (isPending) {
    return (
      <div className='flex items-center justify-center min-h-[50vh] p-4 font-jetbrains'>
        <div className='text-muted-foreground'>Loading...</div>
      </div>
    )
  }

  if (!session?.user) {
    return (
      <div className='flex items-center justify-center min-h-[50vh] p-4 font-jetbrains'>
        <div className='text-center'>
          <p className='mb-4 text-lg text-muted-foreground'>
            Please sign in to access your dashboard
          </p>
          <a
            href='/auth/sign-in'
            className='inline-flex items-center justify-center px-4 py-2 text-base font-medium rounded-none bg-primary text-primary-foreground hover:bg-primary/90'>
            Sign In
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className='container mx-auto max-w-5xl space-y-6 px-4 py-8 font-jetbrains'>
      <DashboardTabs role={session.user.role} />

      <div className='flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between'>
        <div className='max-w-3xl'>
          <h1 className='text-3xl font-black tracking-tight'>{title}</h1>
          {description ? <p className='mt-2 text-muted-foreground'>{description}</p> : null}
        </div>
        {actions ? <div className='flex flex-wrap gap-2'>{actions}</div> : null}
      </div>

      {children}
    </div>
  )
}
