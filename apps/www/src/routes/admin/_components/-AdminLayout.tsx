import { Button, cn, ScrollArea, Sheet, SheetContent, SheetTitle, SheetTrigger } from '@gbfm/ui'
import { Link, useLocation } from '@tanstack/react-router'
import type { LucideIcon } from 'lucide-react'
import {
  AlertTriangle,
  ChartColumn,
  FileAudio,
  FileText,
  FolderKanban,
  LayoutDashboard,
  Mail,
  Menu,
  Music4,
  Radio,
  Search,
  Shield,
  Users
} from 'lucide-react'
import type { ReactNode } from 'react'
import { useState } from 'react'
import { AdminAccessGuard } from './-AdminAccessGuard'

export type AdminNavTo =
  | '/admin'
  | '/admin/overview'
  | '/admin/users'
  | '/admin/content'
  | '/admin/shows'
  | '/admin/sessions'
  | '/admin/email-logs'
  | '/admin/newsletter'
  | '/admin/files'
  | '/admin/music'
  | '/admin/playlists'
  | '/admin/search'
  | '/admin/frontend-errors'

export type AdminNavItem = {
  to: AdminNavTo
  label: string
  description: string
  icon: LucideIcon
}

export const adminPrimaryNavItems: AdminNavItem[] = [
  {
    to: '/admin/overview',
    label: 'Overview',
    description: 'Growth, publishing, and operational health.',
    icon: ChartColumn
  },
  {
    to: '/admin/users',
    label: 'Users',
    description: 'Accounts, roles, bans, and profile editing.',
    icon: Users
  },
  {
    to: '/admin/content',
    label: 'Content',
    description: 'Mixes, editorials, tweets, and labels.',
    icon: FileText
  },
  {
    to: '/admin/shows',
    label: 'Shows',
    description: 'Manage show metadata, hosts, and publishing.',
    icon: Radio
  },
  {
    to: '/admin/newsletter',
    label: 'Newsletter',
    description: 'Subscriber audience and campaign shaping.',
    icon: Mail
  },
  {
    to: '/admin/email-logs',
    label: 'Email Logs',
    description: 'Delivery status, failures, and recent sends.',
    icon: FileAudio
  },
  {
    to: '/admin/sessions',
    label: 'Sessions',
    description: 'Session visibility and auth state cleanup.',
    icon: Shield
  },
  {
    to: '/admin/files',
    label: 'Files',
    description: 'Bucket inspection and cross-bucket copy flows.',
    icon: FolderKanban
  }
]

export const adminSecondaryNavItems: AdminNavItem[] = [
  {
    to: '/admin/music',
    label: 'Music Catalog',
    description: 'Artists, albums, tracks, and playlists.',
    icon: Music4
  },
  {
    to: '/admin/playlists',
    label: 'Playlists',
    description: 'Dedicated playlist import and editing flow.',
    icon: Music4
  },
  {
    to: '/admin/search',
    label: 'Search',
    description: 'Test the content search endpoint.',
    icon: Search
  },
  {
    to: '/admin/frontend-errors',
    label: 'Frontend Errors',
    description: 'Shared fetcher and Sentry behavior checks.',
    icon: AlertTriangle
  }
]

function NavLink({
  item,
  isActive,
  onNavigate
}: {
  item: { to: AdminNavTo; label: string; icon: LucideIcon }
  isActive: boolean
  onNavigate?: () => void
}) {
  const Icon = item.icon

  return (
    <Link
      to={item.to}
      onClick={onNavigate}
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        'flex items-center gap-3 rounded-sm px-3 py-2 text-sm font-medium transition-colors',
        'hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        isActive ? 'bg-foreground text-background hover:bg-foreground' : 'text-foreground'
      )}>
      <Icon className='h-4 w-4 shrink-0' />
      <span className='truncate'>{item.label}</span>
    </Link>
  )
}

function NavGroup({
  title,
  items,
  pathname,
  onNavigate
}: {
  title: string
  items: AdminNavItem[]
  pathname: string
  onNavigate?: () => void
}) {
  return (
    <div className='space-y-1'>
      <div className='px-3 pb-1 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground'>
        {title}
      </div>
      {items.map((item) => (
        <NavLink
          key={item.to}
          item={item}
          isActive={pathname === item.to}
          onNavigate={onNavigate}
        />
      ))}
    </div>
  )
}

function AdminSidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = useLocation().pathname

  return (
    <nav aria-label='Admin' className='flex flex-col gap-6 p-4'>
      <NavLink
        item={{ to: '/admin', label: 'Dashboard', icon: LayoutDashboard }}
        isActive={pathname === '/admin'}
        onNavigate={onNavigate}
      />
      <NavGroup
        title='Core'
        items={adminPrimaryNavItems}
        pathname={pathname}
        onNavigate={onNavigate}
      />
      <NavGroup
        title='Specialized'
        items={adminSecondaryNavItems}
        pathname={pathname}
        onNavigate={onNavigate}
      />
    </nav>
  )
}

export function AdminPage({
  title,
  description,
  actions,
  children
}: {
  title: string
  description: string
  actions?: ReactNode
  children: ReactNode
  backToAdmin?: boolean
  maxWidth?: string
}) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  return (
    <AdminAccessGuard>
      <div className='flex min-h-full'>
        <aside className='sticky top-0 hidden h-dvh w-64 shrink-0 self-start border-r lg:block'>
          <div className='border-b px-4 py-4 text-sm font-black uppercase tracking-[0.18em]'>
            Admin
          </div>
          <ScrollArea className='h-[calc(100dvh-3.5rem)]'>
            <AdminSidebarNav />
          </ScrollArea>
        </aside>

        <div className='min-w-0 flex-1'>
          <div className='container mx-auto max-w-5xl space-y-6 px-4 py-8'>
            <div className='flex flex-col gap-4'>
              <div className='lg:hidden'>
                <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
                  <SheetTrigger asChild>
                    <Button variant='outline' size='sm'>
                      <Menu className='mr-2 h-4 w-4' />
                      Admin menu
                    </Button>
                  </SheetTrigger>
                  <SheetContent side='left' className='w-72 p-0'>
                    <SheetTitle className='border-b px-4 py-4 text-sm font-black uppercase tracking-[0.18em]'>
                      Admin
                    </SheetTitle>
                    <ScrollArea className='h-[calc(100vh-3.5rem)]'>
                      <AdminSidebarNav onNavigate={() => setMobileNavOpen(false)} />
                    </ScrollArea>
                  </SheetContent>
                </Sheet>
              </div>

              <div className='flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between'>
                <div className='max-w-3xl'>
                  <h1 className='text-3xl font-black tracking-tight'>{title}</h1>
                  <p className='mt-2 text-muted-foreground'>{description}</p>
                </div>
                {actions ? <div className='flex flex-wrap gap-2'>{actions}</div> : null}
              </div>
            </div>

            {children}
          </div>
        </div>
      </div>
    </AdminAccessGuard>
  )
}
