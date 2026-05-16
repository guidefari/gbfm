import { Input, SearchIcon } from '@gbfm/ui'
import { Link } from '@tanstack/react-router'
import ProfileAvatar from '../ProfileAvatar'
import { HamburgerMenu } from './Mobile'

export const HorizontalMenu = () => {
  return (
    <header className='flex sticky top-0 z-30 gap-4 justify-between items-center px-4 h-14 sm:static sm:h-auto sm:px-6'>
      <HamburgerMenu />
      <div className='flex justify-center sm:hidden'>
        <ProfileAvatar />
      </div>
      {/* searrrrch */}
      <div className='relative flex-1 ml-auto md:grow-0'>
        <SearchIcon className='absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground' />
        <Input
          type='search'
          placeholder='Search...'
          className='w-full rounded-sm bg-background pl-8 md:w-[200px] lg:w-[336px]'
        />
      </div>
      <nav className='hidden sm:flex items-center gap-8 ml-8'>
        <Link
          to='/changelog'
          className='text-3xl font-bold text-right md:text-5xl xl:text-6xl'>
          changelog<span className='text-highlight'>.</span>
        </Link>
        <a
          href='/todo'
          className='text-3xl font-bold text-right md:text-5xl xl:text-6xl'>
          todo<span className='text-highlight'>.</span>
        </a>
      </nav>
    </header>
  )
}
