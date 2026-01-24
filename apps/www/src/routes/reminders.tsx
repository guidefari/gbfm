import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { useToast } from '@/components/ui/use-toast'
import { fetcher, useEnrichTrackFromUrl, VPS_BASE_URL } from '@/lib/http'
import { useAuthStore } from '@/store'

interface MusicReminder {
  id: string
  userId: string
  musicTitle: string
  artistName: string
  musicUrl: string
  albumCoverUrl: string | null
  reminderDate: string
  notes: string | null
  isSent: boolean
  createdAt: string
  updatedAt: string
}

interface RemindersResponse {
  success: boolean
  reminders: MusicReminder[]
  total: number
}

export const Route = createFileRoute('/reminders')({
  component: MusicReminders
})

function MusicReminders() {
  const { isAuthenticated } = useAuthStore()
  console.log('isAuthenticated:', isAuthenticated)
  const queryClient = useQueryClient()
  const [musicUrl, setMusicUrl] = useState('')
  const [musicTitle, setMusicTitle] = useState('')
  const [artistName, setArtistName] = useState('')
  const [albumCoverUrl, setAlbumCoverUrl] = useState('')
  const [notes, setNotes] = useState('')
  const [reminderDate, setReminderDate] = useState('')
  const { toast } = useToast()

  // Enrich track details when URL changes
  const { data: enrichedTrack, isLoading: isEnriching } =
    useEnrichTrackFromUrl(musicUrl)

  // Auto-fill fields when track is enriched
  useEffect(() => {
    if (enrichedTrack && !musicTitle && !artistName) {
      setMusicTitle(enrichedTrack.title)
      setArtistName(enrichedTrack.artist)
      if (enrichedTrack.thumbnailUrl) {
        setAlbumCoverUrl(enrichedTrack.thumbnailUrl)
      }
    }
  }, [enrichedTrack, musicTitle, artistName])

  // Query existing reminders
  const { data: reminders, isLoading: isLoadingReminders } =
    useQuery<RemindersResponse>({
      queryKey: ['reminders'],
      queryFn: () => fetcher(`${VPS_BASE_URL}/music-reminders`)
    })

  // Create reminder mutation
  const createReminderMutation = useMutation({
    mutationFn: async (data: {
      musicTitle: string
      artistName: string
      musicUrl: string
      albumCoverUrl?: string
      reminderDate: string
      notes?: string
    }) => {
      return fetcher(`${VPS_BASE_URL}/music-reminders`, {
        method: 'POST',
        body: JSON.stringify(data)
      })
    },
    onSuccess: () => {
      // Clear form
      setMusicUrl('')
      setMusicTitle('')
      setArtistName('')
      setAlbumCoverUrl('')
      setNotes('')
      setReminderDate('')

      // Invalidate queries to refresh the reminders list
      queryClient.invalidateQueries({ queryKey: ['reminders'] })

      toast({
        title: 'Reminder created',
        description: 'We will send you an email when the time comes!'
      })
    },
    onError: (error) => {
      console.error('Failed to create reminder:', error)
      toast({
        variant: 'destructive',
        title: 'Failed to create reminder',
        description: 'Please try again later.'
      })
    }
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!musicTitle || !artistName || !musicUrl || !reminderDate) {
      toast({
        variant: 'destructive',
        title: 'Missing information',
        description: 'Please fill in all required fields'
      })
      return
    }

    const isoDateTime = new Date(reminderDate).toISOString()

    const reminderData = {
      musicTitle,
      artistName,
      musicUrl,
      albumCoverUrl: albumCoverUrl || undefined,
      reminderDate: isoDateTime,
      notes: notes || undefined
    }

    createReminderMutation.mutate(reminderData)
  }

  if (!isAuthenticated) {
    return (
      <div className='flex items-center justify-center min-h-screen p-4'>
        <div className='text-center'>
          <p className='text-lg text-muted-foreground mb-4'>
            Please sign in to access music reminders
          </p>
          <a
            href='/auth/sign-in'
            className='inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90'>
            Sign In
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className='p-4 mx-auto max-w-4xl'>
      <h1 className='mb-6 text-3xl font-bold'>Music Reminders</h1>
      <p className='mb-8 text-muted-foreground'>
        Add links to music you want to be reminded to listen to later. We'll
        send you an email when the date comes!
      </p>

      <div className='space-y-6'>
        {/* Add Reminder Form */}
        <div className='rounded-lg border bg-card p-6'>
          <h2 className='mb-4 text-xl font-semibold'>Add New Reminder</h2>
          <form className='space-y-4' onSubmit={handleSubmit}>
            <div>
              <label
                htmlFor='musicUrl'
                className='block text-sm font-medium mb-1'>
                Music URL (Spotify, YouTube, etc.)
              </label>
              <input
                type='url'
                id='musicUrl'
                name='musicUrl'
                required
                value={musicUrl}
                onChange={(e) => setMusicUrl(e.target.value)}
                className='w-full rounded-md border border-input bg-background px-3 py-2 text-sm'
                placeholder='https://...'
              />
              <input type='hidden' name='albumCoverUrl' value={albumCoverUrl} />
              {isEnriching && (
                <p className='text-sm text-muted-foreground mt-1'>
                  Loading track details...
                </p>
              )}
              {enrichedTrack && (
                <div className='mt-2 p-3 bg-muted rounded-md'>
                  <div className='flex items-start gap-3'>
                    {enrichedTrack.thumbnailUrl && (
                      <img
                        src={enrichedTrack.thumbnailUrl}
                        alt={`${enrichedTrack.title} cover`}
                        className='w-12 h-12 rounded-md object-cover flex-shrink-0'
                      />
                    )}
                    <div className='flex-1 min-w-0'>
                      <p className='text-sm font-medium truncate'>
                        Found: {enrichedTrack.title} by {enrichedTrack.artist}
                      </p>
                      {enrichedTrack.album && (
                        <p className='text-xs text-muted-foreground truncate'>
                          Album: {enrichedTrack.album}
                        </p>
                      )}
                      <p className='text-xs text-muted-foreground'>
                        Platform: {enrichedTrack.platform}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className='grid gap-4 md:grid-cols-2'>
              <div>
                <label
                  htmlFor='musicTitle'
                  className='block text-sm font-medium mb-1'>
                  Music Title
                </label>
                <input
                  type='text'
                  id='musicTitle'
                  name='musicTitle'
                  required
                  value={musicTitle}
                  onChange={(e) => setMusicTitle(e.target.value)}
                  className='w-full rounded-md border border-input bg-background px-3 py-2 text-sm'
                  placeholder='Enter song or album title'
                />
              </div>
              <div>
                <label
                  htmlFor='artistName'
                  className='block text-sm font-medium mb-1'>
                  Artist Name
                </label>
                <input
                  type='text'
                  id='artistName'
                  name='artistName'
                  required
                  value={artistName}
                  onChange={(e) => setArtistName(e.target.value)}
                  className='w-full rounded-md border border-input bg-background px-3 py-2 text-sm'
                  placeholder='Enter artist name'
                />
              </div>
            </div>
            <div className='grid gap-4 md:grid-cols-2'>
              <div>
                <label
                  htmlFor='reminderDate'
                  className='block text-sm font-medium mb-1'>
                  Reminder Date
                </label>
                <input
                  type='datetime-local'
                  id='reminderDate'
                  name='reminderDate'
                  required
                  value={reminderDate}
                  onChange={(e) => setReminderDate(e.target.value)}
                  className='w-full rounded-md border border-input bg-background px-3 py-2 text-sm'
                />
              </div>
              <div>
                <label
                  htmlFor='notes'
                  className='block text-sm font-medium mb-1'>
                  Notes (Optional)
                </label>
                <input
                  type='text'
                  id='notes'
                  name='notes'
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className='w-full rounded-md border border-input bg-background px-3 py-2 text-sm'
                  placeholder='Why do you want to listen to this?'
                />
              </div>
            </div>
            <button
              type='submit'
              disabled={createReminderMutation.isPending}
              className='inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-50'>
              {createReminderMutation.isPending
                ? 'Creating...'
                : 'Add Reminder'}
            </button>
          </form>
        </div>

        {/* Existing Reminders */}
        <div className='rounded-lg border bg-card p-6'>
          <h2 className='mb-4 text-xl font-semibold'>Your Reminders</h2>
          {isLoadingReminders ? (
            <div className='text-center text-muted-foreground py-8'>
              <p>Loading your reminders...</p>
            </div>
          ) : reminders?.reminders && reminders?.reminders?.length > 0 ? (
            <div className='space-y-4'>
              {reminders?.reminders
                .sort(
                  (a, b) =>
                    new Date(b.reminderDate).getTime() -
                    new Date(a.reminderDate).getTime()
                )
                .map((reminder: MusicReminder) => (
                  <div
                    key={reminder.id}
                    className='flex items-center justify-between p-4 border rounded-lg'>
                    <div className='flex items-center gap-3'>
                      {reminder.albumCoverUrl && (
                        <img
                          src={reminder.albumCoverUrl}
                          alt={`${reminder.musicTitle} cover`}
                          className='w-10 h-10 rounded object-cover'
                        />
                      )}
                      <div>
                        <p className='font-medium'>{reminder.musicTitle}</p>
                        <p className='text-sm text-muted-foreground'>
                          by {reminder.artistName}
                        </p>
                        <p className='text-xs text-muted-foreground'>
                          {new Date(reminder.reminderDate).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className='text-right'>
                      <span
                        className={`text-xs px-2 py-1 rounded ${
                          reminder.isSent
                            ? 'bg-green-100 text-green-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                        {reminder.isSent ? 'Sent' : 'Pending'}
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <div className='text-center text-muted-foreground py-8'>
              <p>No music reminders yet.</p>
              <p className='text-sm mt-2'>Add your first reminder above!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
