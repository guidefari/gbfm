import { Link } from '@tanstack/react-router'
import { Music } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui/tooltip'
import { MAIN_SCROLL_CONTAINER_ID } from '@/lib/constants'
import { useUIStore } from '@/store'
import { useAuthStore } from '@/store/auth'
import { pagesAndPages } from './NavLinks'
import ProfileAvatar from './ProfileAvatar'

export const DesktopSideNav = () => {
  const { user } = useAuthStore()
  const isAdmin = user?.role === 'admin'

  const filteredPages = pagesAndPages.filter((page) => {
    if (page.adminOnly && !isAdmin) return false
    return true
  })

  const { showCompactPlayer, toggleCompactPlayer, preferredPlayerType } =
    useUIStore()

  const isCompactMode = preferredPlayerType === 'compact'
  const isPlayerVisible = isCompactMode && showCompactPlayer

  return (
    <aside className='sticky top-0 z-30 flex flex-col h-screen border-r w-14 border-border bg-background'>
      <a
        href={`#${MAIN_SCROLL_CONTAINER_ID}`}
        className='absolute top-2 left-2 z-50 px-3 py-2 text-xs font-medium bg-background text-foreground border border-border rounded-sm opacity-0 pointer-events-none focus:opacity-100 focus:pointer-events-auto transition-opacity duration-150'>
        Skip to main content
      </a>
      <nav className='flex flex-col items-center gap-4 px-2 sm:py-5'>
        {filteredPages.map((page) => {
          if (page.CustomComponent) {
            return <div key={page.name}>{page.CustomComponent}</div>
          }
          return (
            <TooltipProvider key={page.name}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link
                    to={page.slug}
                    className='flex items-center justify-center transition-colors rounded-sm h-9 w-9 text-foreground hover:text-highlight md:h-8 md:w-8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'>
                    {page.icon}
                    <span className='sr-only'>{page.name}</span>
                  </Link>
                </TooltipTrigger>
                <TooltipContent side='right'>{page.name}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )
        })}
      </nav>
      <nav className='flex flex-col items-center gap-4 px-2 mt-auto sm:py-5'>
        {isCompactMode && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type='button'
                  onClick={toggleCompactPlayer}
                  className={`flex items-center justify-center transition-all rounded-sm h-9 w-9 md:h-8 md:w-8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    isPlayerVisible
                      ? 'bg-white text-gb-bg shadow-sm'
                      : 'text-foreground hover:text-highlight hover:bg-muted'
                  }`}
                  aria-label='Toggle player'>
                  <Music className='w-4 h-4' />
                </button>
              </TooltipTrigger>
              <TooltipContent side='right'>
                {isPlayerVisible ? 'Hide Player' : 'Show Player'}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        <ProfileAvatar />
      </nav>
    </aside>
  )
}
