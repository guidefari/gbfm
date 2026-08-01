import { useMemo } from 'react'
import { useSession } from '@/lib/auth-client'
import { canSeeNavItem } from '@/lib/nav-access'
import { type NavItem, navItemsForSurface } from '../NavLinks'

export type NavSections = {
  isAuthenticated: boolean
  browse: NavItem[]
  create: NavItem[]
  admin: NavItem[]
  utility: NavItem[]
}

export function useNavSections(): NavSections {
  const { data: session } = useSession()
  const isAuthenticated = Boolean(session?.user)
  const role = session?.user?.role

  return useMemo(() => {
    const items = navItemsForSurface('overlay')
    const access = { isAuthenticated, role }

    return {
      isAuthenticated,
      browse: items.filter(
        (item) =>
          (item.tier === 'primary' || item.tier === 'secondary') &&
          !item.adminOnly &&
          item.id !== 'home' &&
          item.id !== 'shows'
      ),
      create: items.filter((item) => item.tier === 'create' && canSeeNavItem(item, access)),
      admin: items.filter((item) => item.adminOnly && canSeeNavItem(item, access)),
      utility: items.filter((item) => item.tier === 'utility')
    }
  }, [isAuthenticated, role])
}
