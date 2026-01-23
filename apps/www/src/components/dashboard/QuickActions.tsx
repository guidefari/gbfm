import { Link } from '@tanstack/react-router'
import { Bell, Upload } from 'lucide-react'

export function QuickActions() {
  return (
    <div className='flex gap-2'>
      <Link
        to='/upload'
        className='flex items-center gap-2.5 px-5 py-2.5 text-sm font-medium rounded-lg border-2 border-border hover:bg-accent hover:border-accent transition-all duration-200'>
        <Upload className='w-4 h-4' />
        Upload Mix
      </Link>
      <Link
        to='/reminders'
        className='flex items-center gap-2.5 px-5 py-2.5 text-sm font-medium rounded-lg border-2 border-border hover:bg-accent hover:border-accent transition-all duration-200'>
        <Bell className='w-4 h-4' />
        Create Reminder
      </Link>
    </div>
  )
}
