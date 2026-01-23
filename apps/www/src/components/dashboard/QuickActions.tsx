import { Link } from '@tanstack/react-router'
import { Bell, Settings, Upload } from 'lucide-react'

export function QuickActions() {
  return (
    <div className='flex gap-2'>
      <Link
        to='/settings'
        className='flex items-center gap-2.5 px-5 py-2.5 text-sm font-bold uppercase tracking-widest rounded-none border-2 border-primary bg-primary text-primary-foreground hover:bg-transparent hover:text-primary transition-all duration-300'>
        <Settings className='w-4 h-4' />
        Settings
      </Link>

      <Link
        to='/upload'
        className='flex items-center gap-2.5 px-5 py-2.5 text-sm font-bold uppercase tracking-widest rounded-none border-2 border-primary bg-primary text-primary-foreground hover:bg-transparent hover:text-primary transition-all duration-300'>
        <Upload className='w-4 h-4' />
        Upload Mix
      </Link>
      <Link
        to='/reminders'
        className='flex items-center gap-2.5 px-5 py-2.5 text-sm font-bold uppercase tracking-widest rounded-none border-2 border-border hover:bg-accent hover:border-accent transition-all duration-300'>
        <Bell className='w-4 h-4' />
        Create Reminder
      </Link>
    </div>
  )
}
