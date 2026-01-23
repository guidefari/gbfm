import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Bell, History, LucideIcon } from 'lucide-react'
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
      .sort(
        (a, b) =>
          new Date(a.reminderDate).getTime() -
          new Date(b.reminderDate).getTime()
      ) ?? []

  const historyReminders =
    data?.reminders
      .filter((r) => r.isSent)
      .sort(
        (a, b) =>
          new Date(b.reminderDate).getTime() -
          new Date(a.reminderDate).getTime()
      ) ?? []

  const displayedReminders =
    activeTab === 'upcoming'
      ? upcomingReminders.slice(0, 5)
      : historyReminders.slice(0, 5)

  return (
    <div className='flex flex-col h-full bg-card/30 rounded-xl border border-border overflow-hidden'>
      <div className='p-4 border-b border-border bg-muted/20'>
        <div className='flex items-center justify-between mb-4'>
          <h3 className='flex items-center gap-2 text-sm font-semibold text-foreground uppercase tracking-wider'>
            <Bell className='w-4 h-4 text-primary' />
            Reminders
          </h3>
          <Link
            to='/reminders'
            className='text-xs font-medium text-muted-foreground hover:text-primary transition-colors'>
            Manage all
          </Link>
        </div>

        <div className='flex gap-1 p-1 bg-muted/50 rounded-lg'>
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

      <div className='flex-1 p-4'>
        {isPending ? (
          <div className='flex flex-col gap-3'>
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className='h-12 w-full animate-pulse bg-muted rounded-lg'
              />
            ))}
          </div>
        ) : displayedReminders.length === 0 ? (
          <div className='flex flex-col items-center justify-center py-8 text-center'>
            <p className='text-sm text-muted-foreground mb-3'>
              {activeTab === 'upcoming'
                ? 'No upcoming reminders'
                : 'No reminder history'}
            </p>
            {activeTab === 'upcoming' && (
              <Link
                to='/reminders'
                className='text-xs font-semibold px-4 py-1.5 rounded-full border border-primary text-primary hover:bg-primary hover:text-primary-foreground transition-all'>
                Create Reminder
              </Link>
            )}
          </div>
        ) : (
          <div className='space-y-3'>
            {displayedReminders.map((reminder) => (
              <ReminderItem key={reminder.id} reminder={reminder} />
            ))}
            {activeTab === 'upcoming' && upcomingReminders.length > 5 && (
              <p className='text-[10px] text-center text-muted-foreground pt-1'>
                + {upcomingReminders.length - 5} more upcoming
              </p>
            )}
            {activeTab === 'history' && historyReminders.length > 5 && (
              <p className='text-[10px] text-center text-muted-foreground pt-1'>
                + {historyReminders.length - 5} more in history
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
      onClick={onClick}
      className={`
        flex-1 flex items-center justify-center gap-2 py-1.5 text-xs font-medium rounded-md transition-all duration-200
        ${
          active
            ? 'bg-background text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
        }
      `}>
      <Icon className={`w-3.5 h-3.5 ${active ? 'text-primary' : ''}`} />
      {label}
      {count > 0 && (
        <span
          className={`
          ml-0.5 px-1.5 py-0.5 rounded-full text-[10px]
          ${active ? 'bg-primary/10 text-primary' : 'bg-muted-foreground/10 text-muted-foreground'}
        `}>
          {count}
        </span>
      )}
    </button>
  )
}

function ReminderItem({ reminder }: { reminder: MusicReminder }) {
  return (
    <div className='flex items-center gap-3 p-2 rounded-lg hover:bg-accent/50 transition-colors group border border-transparent hover:border-border'>
      <div className='relative flex-shrink-0'>
        {reminder.albumCoverUrl ? (
          <img
            src={reminder.albumCoverUrl}
            alt={reminder.musicTitle}
            className='w-10 h-10 rounded-md object-cover ring-1 ring-border'
          />
        ) : (
          <div className='w-10 h-10 rounded-md bg-muted flex items-center justify-center ring-1 ring-border'>
            <Bell className='w-4 h-4 text-muted-foreground' />
          </div>
        )}
        {reminder.isSent && (
          <div className='absolute -top-1 -right-1 w-3.5 h-3.5 bg-background rounded-full flex items-center justify-center ring-1 ring-border'>
            <div className='w-2 h-2 bg-green-500 rounded-full' />
          </div>
        )}
      </div>
      <div className='flex-1 min-w-0'>
        <p className='text-sm font-semibold truncate group-hover:text-primary transition-colors'>
          {reminder.musicTitle}
        </p>
        <p className='text-xs text-muted-foreground truncate'>
          {reminder.artistName}
        </p>
      </div>
      <span className='text-[10px] font-medium text-muted-foreground bg-muted/30 px-2 py-1 rounded border border-border/50'>
        {new Date(reminder.reminderDate).toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric'
        })}
      </span>
    </div>
  )
}
