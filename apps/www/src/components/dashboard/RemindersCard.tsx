import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Bell, ChevronRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
      )
      .slice(0, 3) ?? []

  if (isPending) {
    return (
      <Card>
        <CardHeader className='pb-3'>
          <CardTitle className='flex items-center gap-2 text-lg'>
            <Bell className='w-5 h-5' />
            Music Reminders
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className='text-sm text-muted-foreground'>Loading...</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className='pb-3'>
        <div className='flex items-center justify-between'>
          <CardTitle className='flex items-center gap-2 text-lg'>
            <Bell className='w-5 h-5' />
            Music Reminders
          </CardTitle>
          <Link
            to='/reminders'
            className='text-sm text-muted-foreground hover:text-foreground flex items-center gap-1'>
            View all
            <ChevronRight className='w-4 h-4' />
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {upcomingReminders.length === 0 ? (
          <div className='text-center py-4'>
            <p className='text-sm text-muted-foreground'>
              No upcoming reminders
            </p>
            <Link
              to='/reminders'
              className='text-sm text-primary hover:underline mt-2 inline-block'>
              Create your first reminder
            </Link>
          </div>
        ) : (
          <div className='space-y-3'>
            {upcomingReminders.map((reminder) => (
              <div key={reminder.id} className='flex items-center gap-3'>
                {reminder.albumCoverUrl ? (
                  <img
                    src={reminder.albumCoverUrl}
                    alt={reminder.musicTitle}
                    className='w-10 h-10 rounded object-cover'
                  />
                ) : (
                  <div className='w-10 h-10 rounded bg-muted flex items-center justify-center'>
                    <Bell className='w-4 h-4 text-muted-foreground' />
                  </div>
                )}
                <div className='flex-1 min-w-0'>
                  <p className='font-medium text-sm truncate'>
                    {reminder.musicTitle}
                  </p>
                  <p className='text-xs text-muted-foreground truncate'>
                    {reminder.artistName}
                  </p>
                </div>
                <div className='text-xs text-muted-foreground'>
                  {new Date(reminder.reminderDate).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
