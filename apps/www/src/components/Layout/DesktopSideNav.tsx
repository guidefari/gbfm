import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@gbfm/ui'
import { Link } from '@tanstack/react-router'
import {
  FilePenLine,
  MessageSquare,
  Music,
  PanelLeftClose,
  PanelLeftOpen
} from 'lucide-react'
import { useSession } from '@/lib/auth-client'
import { MAIN_SCROLL_CONTAINER_ID } from '@/lib/constants'
import { useUIStore } from '@/store'
import { type NavItem, type NavTier, navItemsForSurface } from './NavLinks'
import ProfileAvatar from './ProfileAvatar'

const GROUPS: { tier: NavTier; heading: string }[] = [
  { tier: 'primary', heading: 'Browse' },
  { tier: 'secondary', heading: 'More' },
  { tier: 'utility', heading: 'Follow' }
]

const linkBase =
  'flex items-center h-9 rounded-sm text-sm text-muted-foreground transition-colors hover:text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

const activeClass = 'bg-muted text-foreground font-medium'

const iconSlot = 'flex items-center justify-center w-5 shrink-0'

const Row = ({
  collapsed,
  label,
  children
}: {
  collapsed: boolean
  label: string
  children: React.ReactNode
}) => {
  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent side='right'>{label}</TooltipContent>
      </Tooltip>
    )
  }
  return <>{children}</>
}

const SideNavLink = ({
  page,
  collapsed
}: {
  page: NavItem
  collapsed: boolean
}) => {
  if (!page.slug) return null
  return (
    <Row collapsed={collapsed} label={page.name}>
      <Link
        to={page.slug}
        activeOptions={{ exact: page.slug === '/' }}
        activeProps={{ className: activeClass }}
        className={`${linkBase} ${collapsed ? 'justify-center px-0' : 'gap-3 px-3'}`}
        aria-label={page.name}>
        <span className={iconSlot}>{page.icon}</span>
        {!collapsed && <span className='truncate'>{page.name}</span>}
      </Link>
    </Row>
  )
}

export const DesktopSideNav = () => {
  const { data: session } = useSession()
  const isAdmin = session?.user?.role === 'admin'

  const pages = navItemsForSurface('sidebar').filter(
    (page) => !page.adminOnly || isAdmin
  )

  const home = pages.find((p) => p.id === 'home')
  const grouped = GROUPS.map((group) => ({
    ...group,
    items: pages.filter((p) => p.id !== 'home' && p.tier === group.tier)
  })).filter((group) => group.items.length > 0)

  const {
    showCompactPlayer,
    toggleCompactPlayer,
    preferredPlayerType,
    sidebarCollapsed,
    toggleSidebar
  } = useUIStore()

  const isCompactMode = preferredPlayerType === 'compact'
  const isPlayerVisible = isCompactMode && showCompactPlayer
  const collapsed = sidebarCollapsed

  return (
    <TooltipProvider delayDuration={100}>
      <aside
        className={`sticky top-0 z-30 flex flex-col h-screen border-r border-border bg-background transition-[width] duration-200 ${
          collapsed ? 'w-14' : 'w-52'
        }`}>
        <a
          href={`#${MAIN_SCROLL_CONTAINER_ID}`}
          className='absolute top-2 left-2 z-50 px-3 py-2 text-xs font-medium bg-background text-foreground border border-border rounded-sm opacity-0 pointer-events-none focus:opacity-100 focus:pointer-events-auto transition-opacity duration-150'>
          Skip to main content
        </a>

        <div className='flex items-center px-3 pt-3 justify-start'>
          <Row
            collapsed={collapsed}
            label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
            <button
              type='button'
              onClick={toggleSidebar}
              className='flex items-center justify-center w-8 h-8 rounded-sm text-muted-foreground transition-colors hover:text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
              {collapsed ? (
                <PanelLeftOpen className='w-5 h-5' />
              ) : (
                <PanelLeftClose className='w-5 h-5' />
              )}
            </button>
          </Row>
        </div>

        <nav className='flex flex-col gap-1 px-3 py-3 overflow-y-auto'>
          {home && <SideNavLink page={home} collapsed={collapsed} />}

          {grouped.map((group) => (
            <div key={group.tier} className='mt-4'>
              {!collapsed && (
                <p className='px-3 mb-1 text-xs font-semibold tracking-wider uppercase text-muted-foreground/60'>
                  {group.heading}
                </p>
              )}
              {group.items.map((page) => {
                if (page.CustomComponent) {
                  return (
                    <Row key={page.id} collapsed={collapsed} label={page.name}>
                      <div
                        className={`flex items-center h-9 text-sm text-muted-foreground ${collapsed ? 'justify-center px-0' : 'gap-3 px-3'}`}>
                        <span className={iconSlot}>{page.CustomComponent}</span>
                        {!collapsed && (
                          <span className='truncate'>{page.name}</span>
                        )}
                      </div>
                    </Row>
                  )
                }
                if (page.external) {
                  return (
                    <Row key={page.id} collapsed={collapsed} label={page.name}>
                      <a
                        href={page.external}
                        target='_blank'
                        rel='noreferrer'
                        aria-label={page.name}
                        className={`${linkBase} ${collapsed ? 'justify-center px-0' : 'gap-3 px-3'}`}>
                        <span className={iconSlot}>{page.icon}</span>
                        {!collapsed && (
                          <span className='truncate'>{page.name}</span>
                        )}
                      </a>
                    </Row>
                  )
                }
                return (
                  <SideNavLink
                    key={page.id}
                    page={page}
                    collapsed={collapsed}
                  />
                )
              })}
            </div>
          ))}

          {isAdmin && (
            <div className='mt-4'>
              {!collapsed && (
                <p className='px-3 mb-1 text-xs font-semibold tracking-wider uppercase text-muted-foreground/60'>
                  Create
                </p>
              )}
              <Row collapsed={collapsed} label='New Editorial'>
                <Link
                  to='/new/editorial'
                  activeProps={{ className: activeClass }}
                  aria-label='New Editorial'
                  className={`${linkBase} ${collapsed ? 'justify-center px-0' : 'gap-3 px-3'}`}>
                  <span className={iconSlot}>
                    <FilePenLine className='w-5 h-5' />
                  </span>
                  {!collapsed && (
                    <span className='truncate'>New Editorial</span>
                  )}
                </Link>
              </Row>
              <Row collapsed={collapsed} label='New Tweet'>
                <Link
                  to='/new/tweet'
                  search={{ edit: undefined }}
                  activeProps={{ className: activeClass }}
                  aria-label='New Tweet'
                  className={`${linkBase} ${collapsed ? 'justify-center px-0' : 'gap-3 px-3'}`}>
                  <span className={iconSlot}>
                    <MessageSquare className='w-5 h-5' />
                  </span>
                  {!collapsed && <span className='truncate'>New Tweet</span>}
                </Link>
              </Row>
            </div>
          )}
        </nav>

        <div className='flex flex-col gap-2 px-3 py-4 mt-auto'>
          {isCompactMode && (
            <Row
              collapsed={collapsed}
              label={isPlayerVisible ? 'Hide Player' : 'Show Player'}>
              <button
                type='button'
                onClick={toggleCompactPlayer}
                className={`flex items-center h-9 rounded-sm text-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  collapsed ? 'justify-center px-0' : 'gap-3 px-3'
                } ${
                  isPlayerVisible
                    ? 'bg-white text-gb-bg shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
                aria-label='Toggle player'>
                <span className={iconSlot}>
                  <Music className='w-4 h-4' />
                </span>
                {!collapsed && (
                  <span className='truncate'>
                    {isPlayerVisible ? 'Hide Player' : 'Show Player'}
                  </span>
                )}
              </button>
            </Row>
          )}
          <div className={collapsed ? 'flex justify-center' : ''}>
            <ProfileAvatar />
          </div>
        </div>
      </aside>
    </TooltipProvider>
  )
}
