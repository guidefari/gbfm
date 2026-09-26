import { Predicate } from 'effect'

import type { Principal } from '@/lib/auth/principal'

type Role = 'user' | 'creator' | 'editor' | 'admin'

export type NavIcon =
  | 'radio'
  | 'disc'
  | 'newspaper'
  | 'message'
  | 'tag'
  | 'mail'
  | 'rss'
  | 'youtube'

export const NavTier = { browse: 'browse', create: 'create', follow: 'follow' } as const

type NavTier = (typeof NavTier)[keyof typeof NavTier]

export type NavItem = {
  readonly id: string
  readonly label: string
  readonly href: string
  readonly icon: NavIcon
  readonly tier: NavTier
  readonly desktop?: boolean
  readonly external?: boolean
  readonly copy?: boolean
  readonly minRole?: Role
  readonly matches?: ReadonlyArray<string>
}

export const navItems: ReadonlyArray<NavItem> = [
  {
    id: 'shows',
    label: 'Radio Shows',
    href: '/shows',
    icon: 'radio',
    tier: NavTier.browse,
    desktop: true,
  },
  {
    id: 'editorial',
    label: 'Editorial',
    href: '/editorial',
    icon: 'newspaper',
    tier: NavTier.browse,
    desktop: true,
  },
  { id: 'subscribe', label: 'Subscribe', href: '/subscribe', icon: 'mail', tier: NavTier.browse },
  {
    id: 'tweets',
    label: 'Tweets',
    href: '/tweets',
    icon: 'message',
    tier: NavTier.browse,
    desktop: true,
    matches: ['/tweet'],
  },
  {
    id: 'labels',
    label: 'Record Labels',
    href: '/labels',
    icon: 'tag',
    tier: NavTier.browse,
    desktop: true,
  },
  {
    id: 'my-content',
    label: 'My content',
    href: '/dashboard/content',
    icon: 'newspaper',
    tier: NavTier.create,
    minRole: 'creator',
  },
  {
    id: 'new-mix',
    label: 'New mix',
    href: '/mix-upload',
    icon: 'disc',
    tier: NavTier.create,
    minRole: 'editor',
  },
  {
    id: 'new-post',
    label: 'New post',
    href: '/new',
    icon: 'message',
    tier: NavTier.create,
    minRole: 'editor',
  },
  {
    id: 'manage-labels',
    label: 'Manage labels',
    href: '/dashboard/music',
    icon: 'tag',
    tier: NavTier.create,
    minRole: 'admin',
  },
  {
    id: 'rss',
    label: 'Mixes via RSS',
    href: '/rss.xml',
    icon: 'rss',
    tier: NavTier.follow,
    copy: true,
  },
  {
    id: 'youtube',
    label: 'Mixes via YouTube',
    href: 'https://youtube.com/@goosebumpsfm',
    icon: 'youtube',
    tier: NavTier.follow,
    external: true,
  },
]

const roleRank = { user: 0, creator: 1, editor: 2, admin: 3 } satisfies Record<Role, number>

export const canSeeNavItem = (item: NavItem, principal: Principal) => {
  if (!item.minRole) return true

  return (
    Predicate.isTagged(principal, 'Authenticated') &&
    roleRank[principal.role] >= roleRank[item.minRole]
  )
}

export const isPathActive = (pathname: string, item: Pick<NavItem, 'href' | 'matches'>) => {
  if (item.href === '/') return pathname === '/'

  return [item.href, ...(item.matches ?? [])].some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )
}

export const navSections = (principal: Principal) => ({
  browse: navItems.filter((item) => item.tier === NavTier.browse),
  create: navItems.filter((item) => item.tier === NavTier.create && canSeeNavItem(item, principal)),
  follow: navItems.filter((item) => item.tier === NavTier.follow),
})

export const desktopNavItems = navItems.filter((item) => item.desktop)

export const signInHref = (pathname: string) =>
  `/auth/sign-in?redirect=${encodeURIComponent(pathname)}`
