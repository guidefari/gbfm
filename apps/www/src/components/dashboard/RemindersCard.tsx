import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Bell, Plus } from 'lucide-react'
import { apiUrl, fetcher } from '@/lib/http'

const UPCOMING_LIMIT = 5
const RECENT_LIMIT = 4

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
  const { data, isPending } = useQuery<RemindersResponse>({
    queryKey: ['reminders'],
    queryFn: () => fetcher(apiUrl('/music-reminders'))
  })

  const upcomingReminders =
    data?.reminders
      .filter((r) => !r.isSent)
      .toSorted(
        (a, b) => new Date(a.reminderDate).getTime() - new Date(b.reminderDate).getTime()
      ) ?? []

  const historyReminders =
    data?.reminders
      .filter((r) => r.isSent)
      .toSorted(
        (a, b) => new Date(b.reminderDate).getTime() - new Date(a.reminderDate).getTime()
      ) ?? []

  const isEmpty = !isPending && upcomingReminders.length === 0 && historyReminders.length === 0

  return (
    <div className='flex flex-col h-full bg-card/15 rounded-sm overflow-hidden'>
      <div className='flex items-center justify-between p-5 bg-muted/10'>
        <h3 className='flex items-center gap-2 text-xs font-bold text-foreground tracking-widest'>
          <Bell className='w-3.5 h-3.5 text-primary' />
          Reminders
        </h3>
        <div className='flex items-center gap-3'>
          <Link
            to='/reminders'
            className='flex items-center gap-1 text-[10px] font-bold tracking-widest text-primary no-underline hover:text-primary/80 transition-colors'>
            <Plus className='w-3 h-3' />
            New
          </Link>
          <div className='w-px h-3 bg-border/50' />
          <Link
            to='/reminders'
            className='text-[10px] font-bold tracking-widest text-muted-foreground no-underline hover:text-primary transition-colors'>
            Manage
          </Link>
        </div>
      </div>

      <div className='flex-1 p-5'>
        {isPending ? (
          <div className='flex flex-col gap-4'>
            {[1, 2, 3].map((i) => (
              <div key={i} className='h-12 w-full animate-pulse bg-muted rounded-none' />
            ))}
          </div>
        ) : isEmpty ? (
          <div className='flex flex-col items-center justify-center py-12 text-center'>
            <p className='text-xs font-medium text-muted-foreground mb-4 tracking-wider'>
              No reminders yet
            </p>
            <Link
              to='/reminders'
              className='text-[10px] font-bold tracking-widest px-6 py-2 rounded-sm border border-primary/70 text-primary no-underline hover:bg-primary hover:text-primary-foreground transition-all'>
              Create
            </Link>
          </div>
        ) : (
          <div className='space-y-8'>
            <ReminderSection
              label='Upcoming'
              reminders={upcomingReminders}
              limit={UPCOMING_LIMIT}
              emptyHint={
                <Link
                  to='/reminders'
                  className='text-[10px] font-bold tracking-widest text-primary no-underline hover:text-primary/80 transition-colors'>
                  Set one
                </Link>
              }
            />
            {historyReminders.length > 0 && (
              <ReminderSection label='Recent' reminders={historyReminders} limit={RECENT_LIMIT} />
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function ReminderSection({
  label,
  reminders,
  limit,
  emptyHint
}: {
  label: string
  reminders: MusicReminder[]
  limit: number
  emptyHint?: React.ReactNode
}) {
  const visible = reminders.slice(0, limit)
  const remaining = reminders.length - visible.length

  return (
    <div className='space-y-3'>
      <p className='text-[10px] font-bold tracking-widest text-muted-foreground'>{label}</p>
      {reminders.length === 0 ? (
        <div className='flex items-center gap-2 text-xs text-muted-foreground'>
          <span className='font-medium'>None</span>
          {emptyHint}
        </div>
      ) : (
        <div className='space-y-2'>
          {visible.map((reminder) => (
            <ReminderItem key={reminder.id} reminder={reminder} />
          ))}
          {remaining > 0 && (
            <p className='text-[10px] font-bold tracking-widest text-muted-foreground pt-1'>
              + {remaining} more
            </p>
          )}
        </div>
      )}
    </div>
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
        <p className='text-sm font-bold tracking-tight truncate group-hover:text-primary transition-colors'>
          {reminder.musicTitle}
        </p>
        <p className='text-xs text-muted-foreground truncate font-medium'>{reminder.artistName}</p>
      </div>
      <span className='text-[9px] font-bold text-muted-foreground border border-border/50 px-2 py-1 rounded-sm'>
        {new Date(reminder.reminderDate).toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric'
        })}
      </span>
    </div>
  )
}
