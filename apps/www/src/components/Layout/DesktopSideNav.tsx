import { Link } from '@tanstack/react-router'
import { Music } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui/tooltip'
import { useUIStore } from '@/store'
import { useAuthStore } from '@/store/auth'
import { pagesAndPages } from './NavLinks'
import ProfileAvatar from './ProfileAvatar'

export const DesktopSideNav = () => {
  const { user } = useAuthStore()
  console.log(user)
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
                    className='flex items-center justify-center transition-colors rounded-sm h-9 w-9 text-gb-bg hover:text-white md:h-8 md:w-8'>
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
                  className={`flex items-center justify-center transition-all rounded-sm h-9 w-9 md:h-8 md:w-8 ${
                    isPlayerVisible
                      ? 'bg-white text-gb-bg shadow-sm'
                      : 'text-gb-bg hover:text-white hover:bg-muted'
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
