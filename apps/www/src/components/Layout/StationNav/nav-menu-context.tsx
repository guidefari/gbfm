import { createContext, useContext } from 'react'

type NavMenuContextValue = {
  openMenu: () => void
  isMenuOpen: boolean
}

const NavMenuContext = createContext<NavMenuContextValue | null>(null)

export function NavMenuProvider({
  value,
  children
}: {
  value: NavMenuContextValue
  children: React.ReactNode
}) {
  return <NavMenuContext.Provider value={value}>{children}</NavMenuContext.Provider>
}

export function useNavMenu() {
  const ctx = useContext(NavMenuContext)
  if (!ctx) throw new Error('useNavMenu must be used within NavMenuProvider')
  return ctx
}

export function useNavMenuOptional() {
  return useContext(NavMenuContext)
}
