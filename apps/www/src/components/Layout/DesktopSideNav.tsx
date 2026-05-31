import { Link } from '@tanstack/react-router'
import { FilePenLine, MessageSquare, Music } from 'lucide-react'
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
  'flex items-center gap-3 px-3 h-9 rounded-sm text-sm text-muted-foreground transition-colors hover:text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

const activeClass = 'bg-muted text-foreground font-medium'

const SideNavLink = ({ page }: { page: NavItem }) => {
  if (!page.slug) return null
  return (
    <Link
      to={page.slug}
      activeOptions={{ exact: page.slug === '/' }}
      activeProps={{ className: activeClass }}
      className={linkBase}>
      <span className='flex items-center justify-center w-5 shrink-0'>
        {page.icon}
      </span>
      <span className='truncate'>{page.name}</span>
    </Link>
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

  const { showCompactPlayer, toggleCompactPlayer, preferredPlayerType } =
    useUIStore()

  const isCompactMode = preferredPlayerType === 'compact'
  const isPlayerVisible = isCompactMode && showCompactPlayer

  return (
    <aside className='sticky top-0 z-30 flex flex-col h-screen border-r w-52 border-border bg-background'>
      <a
        href={`#${MAIN_SCROLL_CONTAINER_ID}`}
        className='absolute top-2 left-2 z-50 px-3 py-2 text-xs font-medium bg-background text-foreground border border-border rounded-sm opacity-0 pointer-events-none focus:opacity-100 focus:pointer-events-auto transition-opacity duration-150'>
        Skip to main content
      </a>

      <nav className='flex flex-col gap-1 px-3 py-5 overflow-y-auto'>
        {home && <SideNavLink page={home} />}

        {grouped.map((group) => (
          <div key={group.tier} className='mt-4'>
            <p className='px-3 mb-1 text-xs font-semibold tracking-wider uppercase text-muted-foreground/60'>
              {group.heading}
            </p>
            {group.items.map((page) => {
              if (page.CustomComponent) {
                return (
                  <div
                    key={page.id}
                    className='flex items-center gap-3 px-3 h-9 text-sm text-muted-foreground'>
                    <span className='flex items-center justify-center w-5 shrink-0'>
                      {page.CustomComponent}
                    </span>
                    <span className='truncate'>{page.name}</span>
                  </div>
                )
              }
              if (page.external) {
                return (
                  <a
                    key={page.id}
                    href={page.external}
                    target='_blank'
                    rel='noreferrer'
                    className={linkBase}>
                    <span className='flex items-center justify-center w-5 shrink-0'>
                      {page.icon}
                    </span>
                    <span className='truncate'>{page.name}</span>
                  </a>
                )
              }
              return <SideNavLink key={page.id} page={page} />
            })}
          </div>
        ))}

        {isAdmin && (
          <div className='mt-4'>
            <p className='px-3 mb-1 text-xs font-semibold tracking-wider uppercase text-muted-foreground/60'>
              Create
            </p>
            <Link
              to='/new/editorial'
              activeProps={{ className: activeClass }}
              className={linkBase}>
              <span className='flex items-center justify-center w-5 shrink-0'>
                <FilePenLine className='w-5 h-5' />
              </span>
              <span className='truncate'>New Editorial</span>
            </Link>
            <Link
              to='/new/tweet'
              search={{ edit: undefined }}
              activeProps={{ className: activeClass }}
              className={linkBase}>
              <span className='flex items-center justify-center w-5 shrink-0'>
                <MessageSquare className='w-5 h-5' />
              </span>
              <span className='truncate'>New Tweet</span>
            </Link>
          </div>
        )}
      </nav>

      <div className='flex flex-col gap-2 px-3 py-4 mt-auto'>
        {isCompactMode && (
          <button
            type='button'
            onClick={toggleCompactPlayer}
            className={`flex items-center gap-3 px-3 h-9 rounded-sm text-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              isPlayerVisible
                ? 'bg-white text-gb-bg shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
            aria-label='Toggle player'>
            <span className='flex items-center justify-center w-5 shrink-0'>
              <Music className='w-4 h-4' />
            </span>
            <span className='truncate'>
              {isPlayerVisible ? 'Hide Player' : 'Show Player'}
            </span>
          </button>
        )}
        <ProfileAvatar />
      </div>
    </aside>
  )
}
