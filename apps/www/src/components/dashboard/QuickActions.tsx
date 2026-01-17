import { Link } from '@tanstack/react-router'
import { Bell, Upload } from 'lucide-react'

export function QuickActions() {
  return (
    <div className='flex gap-3'>
      <Link
        to='/upload'
        className='flex items-center gap-2 px-4 py-2 rounded-md border border-border bg-card hover:bg-accent transition-colors'>
        <Upload className='w-4 h-4' />
        <span>Upload Mix</span>
      </Link>
      <Link
        to='/reminders'
        className='flex items-center gap-2 px-4 py-2 rounded-md border border-border bg-card hover:bg-accent transition-colors'>
        <Bell className='w-4 h-4' />
        <span>Create Reminder</span>
      </Link>
    </div>
  )
}
