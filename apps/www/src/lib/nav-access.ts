import { hasMinRole, type Role } from '@gbfm/core/roles'
import type { NavItem } from '@/components/Layout/NavLinks'

export { hasMinRole }
export type { Role }

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
