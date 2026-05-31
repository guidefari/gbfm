import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Bell, History, type LucideIcon, Plus } from 'lucide-react'
import { useState } from 'react'
import { fetcher, VPS_BASE_URL } from '@/lib/http'

interface MusicReminder {
  id: string
  musicTitle: string
  artistName: string
  albumCoverUrl: string | null
  reminderDate: string
  isSent: boolean
}

interface RemindersResponse {
  success: boolean
  reminders: MusicReminder[]
  total: number
}

export function RemindersCard() {
  const [activeTab, setActiveTab] = useState<'upcoming' | 'history'>('upcoming')

  const { data, isPending } = useQuery<RemindersResponse>({
    queryKey: ['reminders'],
    queryFn: () => fetcher(`${VPS_BASE_URL}/music-reminders`)
  })

  const upcomingReminders =
    data?.reminders
      .filter((r) => !r.isSent)
      .toSorted(
        (a, b) => new Date(b.reminderDate).getTime() - new Date(a.reminderDate).getTime()
      ) ?? []

  const historyReminders =
    data?.reminders
      .filter((r) => r.isSent)
      .toSorted(
        (a, b) => new Date(b.reminderDate).getTime() - new Date(a.reminderDate).getTime()
      ) ?? []

  const displayedReminders =
    activeTab === 'upcoming' ? upcomingReminders.slice(0, 5) : historyReminders.slice(0, 5)

  return (
    <div className='flex flex-col h-full bg-card/15 rounded-sm overflow-hidden'>
      <div className='p-5 bg-muted/10'>
        <div className='flex items-center justify-between mb-6'>
          <h3 className='flex items-center gap-2 text-xs font-bold text-foreground uppercase tracking-widest'>
            <Bell className='w-3.5 h-3.5 text-primary' />
            Reminders
          </h3>
          <div className='flex items-center gap-3'>
            <Link
              to='/reminders'
              className='flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-primary no-underline hover:text-primary/80 transition-colors'>
              <Plus className='w-3 h-3' />
              New
            </Link>
            <div className='w-px h-3 bg-border/50' />
            <Link
              to='/reminders'
              className='text-[10px] font-bold uppercase tracking-widest text-muted-foreground no-underline hover:text-primary transition-colors'>
              Manage
            </Link>
          </div>
        </div>

        <div className='flex gap-0 border border-border/50 rounded-sm overflow-hidden'>
          <TabButton
            active={activeTab === 'upcoming'}
            onClick={() => setActiveTab('upcoming')}
            icon={Bell}
            label='Upcoming'
            count={upcomingReminders.length}
          />
          <TabButton
            active={activeTab === 'history'}
            onClick={() => setActiveTab('history')}
            icon={History}
            label='History'
            count={historyReminders.length}
          />
        </div>
      </div>

      <div className='flex-1 p-5'>
        {isPending ? (
          <div className='flex flex-col gap-4'>
            {[1, 2, 3].map((i) => (
              <div key={i} className='h-12 w-full animate-pulse bg-muted rounded-none' />
            ))}
          </div>
        ) : displayedReminders.length === 0 ? (
          <div className='flex flex-col items-center justify-center py-12 text-center'>
            <p className='text-xs font-medium text-muted-foreground mb-4 uppercase tracking-wider'>
              {activeTab === 'upcoming' ? 'No upcoming' : 'No history'}
            </p>
            {activeTab === 'upcoming' && (
              <Link
                to='/reminders'
                className='text-[10px] font-bold uppercase tracking-widest px-6 py-2 rounded-sm border border-primary/70 text-primary no-underline hover:bg-primary hover:text-primary-foreground transition-all'>
                Create
              </Link>
            )}
          </div>
        ) : (
          <div className='space-y-4'>
            {displayedReminders.map((reminder) => (
              <ReminderItem key={reminder.id} reminder={reminder} />
            ))}
            {activeTab === 'upcoming' && upcomingReminders.length > 5 && (
              <p className='text-[10px] text-center font-bold uppercase tracking-widest text-muted-foreground pt-2'>
                + {upcomingReminders.length - 5} more
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  label,
  count
}: {
  active: boolean
  onClick: () => void
  icon: LucideIcon
  label: string
  count: number
}) {
  return (
    <button
      type='button'
      onClick={onClick}
      className={`
        flex-1 flex items-center justify-center gap-2 py-2.5 text-[10px] font-bold uppercase tracking-widest transition-all duration-200
        ${
          active
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted'
        }
      `}>
      <Icon className='w-3 h-3' />
      {label}
      {count > 0 && (
        <span
          className={`
          ml-1 px-1.5 py-0.5 rounded-none text-[9px]
          ${active ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted-foreground/10 text-muted-foreground'}
        `}>
          {count}
        </span>
      )}
    </button>
  )
}

function ReminderItem({ reminder }: { reminder: MusicReminder }) {
  return (
    <div className='flex items-center gap-4 p-2 rounded-sm hover:bg-muted/40 transition-colors group'>
      <div className='relative shrink-0'>
        {reminder.albumCoverUrl ? (
          <img
            src={reminder.albumCoverUrl}
            alt={reminder.musicTitle}
            className='w-12 h-12 rounded-sm object-cover border border-border/50'
          />
        ) : (
          <div className='w-12 h-12 rounded-sm bg-muted flex items-center justify-center border border-border/50'>
            <Bell className='w-5 h-5 text-muted-foreground' />
          </div>
        )}
        {reminder.isSent && (
          <div className='absolute -top-1 -right-1 w-4 h-4 bg-background rounded-sm flex items-center justify-center border border-border/50'>
            <div className='w-2 h-2 bg-green-500 rounded-sm' />
          </div>
        )}
      </div>
      <div className='flex-1 min-w-0'>
        <p className='text-sm font-bold uppercase tracking-tight truncate group-hover:text-primary transition-colors'>
          {reminder.musicTitle}
        </p>
        <p className='text-xs text-muted-foreground truncate font-medium'>{reminder.artistName}</p>
      </div>
      <span className='text-[9px] font-bold uppercase text-muted-foreground border border-border/50 px-2 py-1 rounded-sm'>
        {new Date(reminder.reminderDate).toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric'
        })}
      </span>
    </div>
  )
}
