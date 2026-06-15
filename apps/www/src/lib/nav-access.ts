import type { NavItem } from '@/components/Layout/NavLinks'

export type Role = 'user' | 'creator' | 'editor' | 'admin'

const roleRank: Record<Role, number> = {
  user: 0,
  creator: 1,
  editor: 2,
  admin: 3
}

const isRole = (value: string): value is Role => value in roleRank

export function hasMinRole(
  userRole: string | null | undefined,
  minRole: 'editor' | 'admin'
): boolean {
  if (!userRole || !isRole(userRole)) return false
  return roleRank[userRole] >= roleRank[minRole]
}

type NavAccessContext = {
  isAuthenticated: boolean
  role: string | null | undefined
}

export function canSeeNavItem(item: NavItem, { isAuthenticated, role }: NavAccessContext): boolean {
  if (item.adminOnly) return role === 'admin'
  if (item.minRole) return hasMinRole(role, item.minRole)
  if (item.authOnly) return isAuthenticated
  return true
}
