import { Link } from '@tanstack/react-router'
import { Bell, Settings, Upload } from 'lucide-react'

export function QuickActions() {
  return (
    <div className='flex flex-wrap gap-2.5'>
      <Link
        to='/settings'
        className='flex items-center gap-2 px-3 py-2 text-xs sm:text-sm sm:px-5 sm:py-2.5 sm:gap-2.5 font-bold uppercase tracking-widest no-underline rounded-sm border border-primary/70 bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-300 whitespace-nowrap'>
        <Settings className='w-4 h-4' />
        Settings
      </Link>

      <Link
        to='/upload'
        className='flex items-center gap-2 px-3 py-2 text-xs sm:text-sm sm:px-5 sm:py-2.5 sm:gap-2.5 font-bold uppercase tracking-widest no-underline rounded-sm border border-primary/70 bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-300 whitespace-nowrap'>
        <Upload className='w-4 h-4' />
        Upload Mix
      </Link>
      <Link
        to='/reminders'
        className='flex items-center gap-2 px-3 py-2 text-xs sm:text-sm sm:px-5 sm:py-2.5 sm:gap-2.5 font-bold uppercase tracking-widest no-underline rounded-sm bg-foreground/5 hover:bg-accent/60 transition-all duration-300 whitespace-nowrap'>
        <Bell className='w-4 h-4' />
        Create Reminder
      </Link>
    </div>
  )
}
