import {
  AlertTriangle,
  AtSign,
  ChartColumn,
  DownloadCloud,
  FileAudio,
  FileText,
  Home,
  Link2,
  Mail,
  MessageSquare,
  Music,
  Music4,
  Palette,
  Radio,
  Search,
  Shield,
  User as UserIcon,
  Users
} from 'lucide-react'
import type { SidebarNavItem } from '@/components/Layout/SidebarLayout'

export type WorkspaceAccess = 'everyone' | 'postCreate' | 'admin'

export type WorkspaceNavItem = SidebarNavItem & { access: WorkspaceAccess }

export type WorkspaceNavGroup = {
  title: string
  items: WorkspaceNavItem[]
}

export const workspaceNav: WorkspaceNavGroup[] = [
  {
    title: 'You',
    items: [
      { to: '/dashboard', label: 'Home', icon: Home, access: 'everyone' },
      { to: '/dashboard/profile', label: 'Profile', icon: UserIcon, access: 'everyone' },
      { to: '/dashboard/appearance', label: 'Appearance', icon: Palette, access: 'everyone' },
      { to: '/dashboard/player', label: 'Player', icon: Music, access: 'everyone' },
      { to: '/dashboard/email', label: 'Email', icon: Mail, access: 'everyone' }
    ]
  },
  {
    title: 'Create',
    items: [
      {
        to: '/dashboard/content/mixes',
        label: 'Mixes',
        description: 'Audio, artwork, and publishing state.',
        icon: Music4,
        access: 'postCreate'
      },
      {
        to: '/dashboard/content/editorial',
        label: 'Editorial',
        description: 'Long form posts.',
        icon: FileText,
        access: 'postCreate'
      },
      {
        to: '/dashboard/content/tweets',
        label: 'Tweets',
        description: 'Short posts and imported drafts.',
        icon: MessageSquare,
        access: 'postCreate'
      },
      {
        to: '/dashboard/bluesky',
        label: 'Bluesky',
        description: 'Sync your archive and review imported drafts.',
        icon: AtSign,
        access: 'postCreate'
      },
      {
        to: '/dashboard/imports',
        label: 'Imports',
        icon: DownloadCloud,
        access: 'postCreate'
      },
      {
        to: '/dashboard/integrations',
        label: 'Integrations',
        icon: Link2,
        access: 'everyone'
      }
    ]
  },
  {
    title: 'Admin',
    items: [
      {
        to: '/dashboard/overview',
        label: 'Overview',
        description: 'Growth, publishing, and operational health.',
        icon: ChartColumn,
        access: 'admin'
      },
      {
        to: '/dashboard/users',
        label: 'Users',
        description: 'Accounts, roles, bans, and profile editing.',
        icon: Users,
        access: 'admin'
      },
      {
        to: '/dashboard/all/mixes',
        label: 'All mixes',
        description: 'Every mix across the site.',
        icon: Music4,
        access: 'admin'
      },
      {
        to: '/dashboard/all/editorial',
        label: 'All editorial',
        description: 'Every editorial post across the site.',
        icon: FileText,
        access: 'admin'
      },
      {
        to: '/dashboard/all/tweets',
        label: 'All tweets',
        description: 'Every tweet across the site.',
        icon: MessageSquare,
        access: 'admin'
      },
      {
        to: '/dashboard/shows',
        label: 'Shows',
        description: 'Manage show metadata, hosts, and publishing.',
        icon: Radio,
        access: 'admin'
      },
      {
        to: '/dashboard/newsletter',
        label: 'Newsletter',
        description: 'Subscriber audience and campaign shaping.',
        icon: Mail,
        access: 'admin'
      },
      {
        to: '/dashboard/email-logs',
        label: 'Email Logs',
        description: 'Delivery status, failures, and recent sends.',
        icon: FileAudio,
        access: 'admin'
      },
      {
        to: '/dashboard/sessions',
        label: 'Sessions',
        description: 'Session visibility and auth state cleanup.',
        icon: Shield,
        access: 'admin'
      }
    ]
  },
  {
    title: 'Catalog',
    items: [
      {
        to: '/dashboard/music',
        label: 'Music Catalog',
        description: 'Artists, albums, tracks, and playlists.',
        icon: Music4,
        access: 'admin'
      },
      {
        to: '/dashboard/playlists',
        label: 'Playlists',
        description: 'Dedicated playlist import and editing flow.',
        icon: Music4,
        access: 'admin'
      },
      {
        to: '/dashboard/search',
        label: 'Search',
        description: 'Test the content search endpoint.',
        icon: Search,
        access: 'admin'
      },
      {
        to: '/dashboard/frontend-errors',
        label: 'Frontend Errors',
        description: 'Shared fetcher and Sentry behavior checks.',
        icon: AlertTriangle,
        access: 'admin'
      }
    ]
  }
]
