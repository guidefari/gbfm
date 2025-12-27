import { Link } from '@tanstack/react-router'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui/tooltip'
import { pagesAndPages } from './NavLinks'
import ProfileAvatar from './ProfileAvatar'

export const DesktopSideNav = () => {
  return (
    <aside className='z-30 flex-col flex w-14 h-screen sticky top-0'>
      <nav className='flex flex-col items-center gap-4 px-2 sm:py-5'>
        {pagesAndPages.map((page) => {
          if (page.CustomComponent) {
            return <div key={page.name}>{page.CustomComponent}</div>
          }
          return (
            <TooltipProvider key={page.name}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link
                    to={page.slug}
                    className='flex items-center justify-center transition-colors rounded-lg h-9 w-9 text-gb-bg hover:text-white md:h-8 md:w-8'>
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
        <ProfileAvatar />
      </nav>
    </aside>
  )
}
