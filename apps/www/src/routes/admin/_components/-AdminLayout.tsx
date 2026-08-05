import type { LinkProps } from '@tanstack/react-router'
import {
  AlertTriangle,
  AtSign,
  ChartColumn,
  FileAudio,
  FileText,
  LayoutDashboard,
  Mail,
  Music4,
  Radio,
  Search,
  Shield,
  Users
} from 'lucide-react'
import type { ReactNode } from 'react'
import {
  SidebarLayout,
  SidebarNavGroup,
  type SidebarNavItem,
  SidebarNavLink
} from '@/components/Layout/SidebarLayout'
import { AdminAccessGuard } from './-AdminAccessGuard'

export type AdminNavTo = Extract<
  LinkProps['to'],
  | '/admin'
  | '/admin/overview'
  | '/admin/users'
  | '/admin/content'
  | '/admin/bluesky'
  | '/admin/shows'
  | '/admin/sessions'
  | '/admin/email-logs'
  | '/admin/newsletter'
  | '/admin/music'
  | '/admin/playlists'
  | '/admin/search'
  | '/admin/frontend-errors'
>

export type AdminNavItem = SidebarNavItem & { to: AdminNavTo }

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
    description: 'Mixes, editorials, and tweets.',
    icon: FileText
  },
  {
    to: '/admin/bluesky',
    label: 'Bluesky',
    description: 'Sync your Bluesky archive and review imported drafts.',
    icon: AtSign
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

function AdminNav({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <>
      <SidebarNavLink
        item={{ to: '/admin', label: 'Dashboard', icon: LayoutDashboard }}
        onNavigate={onNavigate}
      />
      <SidebarNavGroup title='Core' items={adminPrimaryNavItems} onNavigate={onNavigate} />
      <SidebarNavGroup title='Specialized' items={adminSecondaryNavItems} onNavigate={onNavigate} />
    </>
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
  return (
    <SidebarLayout
      brand='Admin'
      nav={AdminNav}
      title={title}
      description={description}
      actions={actions}
      guard={(c) => <AdminAccessGuard>{c}</AdminAccessGuard>}>
      {children}
    </SidebarLayout>
  )
}
