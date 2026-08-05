export const ROLES = ['user', 'creator', 'editor', 'admin'] as const

export type Role = (typeof ROLES)[number]

const roleRank: Record<Role, number> = {
  user: 0,
  creator: 1,
  editor: 2,
  admin: 3
}

export const isRole = (value: string): value is Role => value in roleRank

export function hasMinRole(userRole: string | null | undefined, minRole: Role): boolean {
  if (!userRole || !isRole(userRole)) return false
  return roleRank[userRole] >= roleRank[minRole]
}

export const canCreatePosts = (userRole: string | null | undefined): boolean =>
  hasMinRole(userRole, 'creator')
