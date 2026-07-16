import { Button, Input, Textarea, useToast } from '@gbfm/ui'
import { createFileRoute } from '@tanstack/react-router'
import { CalendarClock, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useSession } from '@/lib/auth-client'
import {
  useCreateMusicReminder,
  useDeleteMusicReminder,
  useEnrichTrackFromUrl,
  useMusicReminders
} from '@/lib/http'
import { log } from '@/services/logger'

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

export const Route = createFileRoute('/reminders')({
  component: MusicReminders
})

const formatReminderDateValue = (value: string) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  })
}

function MusicReminders() {
  const { data: session } = useSession()
  const isAuthenticated = Boolean(session?.user)
  log('debug', 'isAuthenticated', { isAuthenticated })
  const [musicUrl, setMusicUrl] = useState('')
  const [musicTitle, setMusicTitle] = useState('')
  const [artistName, setArtistName] = useState('')
  const [albumCoverUrl, setAlbumCoverUrl] = useState('')
  const [notes, setNotes] = useState('')
  const [reminderDate, setReminderDate] = useState('')
  const { toast } = useToast()
  const dateInputRef = useRef<HTMLInputElement>(null)

  const handleDateInputPointerDown = () => {
    const input = dateInputRef.current
    if (input && 'showPicker' in input && typeof input.showPicker === 'function') {
      input.showPicker()
    }
  }
  // Enrich track details when URL changes
  const { data: enrichedTrack, isLoading: isEnriching } = useEnrichTrackFromUrl(musicUrl)

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
  const { data: reminders, isLoading: isLoadingReminders } = useMusicReminders()

  // Create reminder mutation
  const createReminderMutation = useCreateMusicReminder()
  const deleteReminderMutation = useDeleteMusicReminder()

  const handleDelete = async (reminder: MusicReminder) => {
    if (!confirm(`Delete reminder for "${reminder.musicTitle}"? This cannot be undone.`)) return
    try {
      await deleteReminderMutation.mutateAsync(reminder.id)
      toast({ title: 'Reminder deleted' })
    } catch (error) {
      log('error', 'Failed to delete reminder', { error })
      toast({
        variant: 'destructive',
        title: 'Failed to delete reminder',
        description: 'Please try again later.'
      })
    }
  }

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

    createReminderMutation.mutate(reminderData, {
      onSuccess: () => {
        setMusicUrl('')
        setMusicTitle('')
        setArtistName('')
        setAlbumCoverUrl('')
        setNotes('')
        setReminderDate('')

        toast({
          title: 'Reminder created',
          description: 'We will send you an email when the time comes!'
        })
      },
      onError: (error) => {
        log('error', 'Failed to create reminder', { error })
        toast({
          variant: 'destructive',
          title: 'Failed to create reminder',
          description: 'Please try again later.'
        })
      }
    })
  }

  if (!isAuthenticated) {
    return (
      <div className='flex items-center justify-center min-h-screen p-4'>
        <div className='text-center'>
          <p className='mb-4 text-lg text-muted-foreground'>
            Please sign in to access music reminders
          </p>
          <a
            href='/auth/sign-in'
            className='inline-flex items-center justify-center px-4 py-2 text-sm font-medium  bg-primary text-primary-foreground hover:bg-primary/90'>
            Sign In
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className='max-w-4xl p-4 mx-auto'>
      <h1 className='mb-6 text-3xl font-bold'>Music Reminders</h1>
      <p className='mb-8 text-muted-foreground'>
        Add links to music you want to be reminded to listen to later. We'll send you an email when
        the date comes!
      </p>

      <div className='space-y-6'>
        {/* Add Reminder Form */}
        <div className='p-6 border rounded-lg bg-card'>
          <h2 className='mb-4 text-xl font-semibold'>Add New Reminder</h2>
          <form className='space-y-4' onSubmit={handleSubmit}>
            <div>
              <label htmlFor='musicUrl' className='block mb-1 text-sm font-medium'>
                Music URL (Spotify, YouTube, etc.)
              </label>
              <Input
                type='url'
                id='musicUrl'
                name='musicUrl'
                required
                value={musicUrl}
                onChange={(e) => setMusicUrl(e.target.value)}
                className='w-full px-3 py-2 border  border-input bg-background'
                placeholder='https://...'
              />
              <input type='hidden' name='albumCoverUrl' value={albumCoverUrl} />
              {isEnriching && (
                <p className='mt-1 text-muted-foreground'>Loading track details...</p>
              )}
              {enrichedTrack && (
                <div className='p-3 mt-2  bg-muted'>
                  <div className='flex items-start gap-3'>
                    {enrichedTrack.thumbnailUrl && (
                      <img
                        src={enrichedTrack.thumbnailUrl}
                        alt={`${enrichedTrack.title} cover`}
                        className='shrink-0 object-cover w-12 h-12 '
                      />
                    )}
                    <div className='flex-1 min-w-0'>
                      <p className=' font-medium truncate'>
                        Found: {enrichedTrack.title} by {enrichedTrack.artist}
                      </p>
                      {enrichedTrack.album && (
                        <p className='text-xs truncate text-muted-foreground'>
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
                <label htmlFor='musicTitle' className='block mb-1 text-sm font-medium'>
                  Music Title
                </label>
                <Input
                  type='text'
                  id='musicTitle'
                  name='musicTitle'
                  required
                  value={musicTitle}
                  onChange={(e) => setMusicTitle(e.target.value)}
                  className='w-full px-3 py-2  border  border-input bg-background'
                  placeholder='Enter song or album title'
                />
              </div>
              <div>
                <label htmlFor='artistName' className='block mb-1 text-sm font-medium'>
                  Artist Name
                </label>
                <Input
                  type='text'
                  id='artistName'
                  name='artistName'
                  required
                  value={artistName}
                  onChange={(e) => setArtistName(e.target.value)}
                  className='w-full px-3 py-2  border  border-input bg-background'
                  placeholder='Enter artist name'
                />
              </div>
            </div>
            <div className='grid gap-4 md:grid-cols-2'>
              <div>
                <label htmlFor='reminderDate' className='block mb-1 text-sm font-medium'>
                  Reminder Date
                </label>
                <div className='relative w-full h-10 overflow-hidden border  border-input bg-background'>
                  <div className='flex items-center h-full min-w-0 gap-2 px-3  pointer-events-none'>
                    <CalendarClock className='shrink-0 w-4 h-4 text-muted-foreground' />
                    <span
                      className={
                        reminderDate ? 'truncate text-base' : 'truncate text-muted-foreground'
                      }>
                      {reminderDate ? formatReminderDateValue(reminderDate) : 'Pick date and time'}
                    </span>
                  </div>
                  <Input
                    type='datetime-local'
                    id='reminderDate'
                    name='reminderDate'
                    required
                    ref={dateInputRef}
                    value={reminderDate}
                    onChange={(e) => setReminderDate(e.target.value)}
                    onPointerDown={handleDateInputPointerDown}
                    className='absolute inset-0 w-full h-full opacity-0 cursor-pointer'
                  />
                </div>
              </div>
              <div>
                <label htmlFor='notes' className='block mb-2 text-sm font-medium'>
                  Notes (Optional)
                </label>
                <Textarea
                  id='notes'
                  name='notes'
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className='min-h-32 w-full resize-y border-border/70 bg-background px-3 py-2 leading-relaxed shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
                  placeholder='Add a memory, reason, or note for future you...'
                />
              </div>
            </div>
            <button
              type='submit'
              disabled={createReminderMutation.isPending}
              className='inline-flex items-center justify-center px-4 py-2 text-sm font-medium  bg-primary text-primary-foreground hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-50'>
              {createReminderMutation.isPending ? 'Creating...' : 'Add Reminder'}
            </button>
          </form>
        </div>

        {/* Existing Reminders */}
        <div className='p-6 border rounded-lg bg-card'>
          <h2 className='mb-4 text-xl font-semibold'>Your Reminders</h2>
          {isLoadingReminders ? (
            <div className='py-8 text-center text-muted-foreground'>
              <p>Loading your reminders...</p>
            </div>
          ) : reminders?.reminders && reminders?.reminders?.length > 0 ? (
            <div className='space-y-4'>
              {reminders?.reminders
                .toSorted(
                  (a, b) => new Date(b.reminderDate).getTime() - new Date(a.reminderDate).getTime()
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
                          className='object-cover w-10 h-10 rounded'
                        />
                      )}
                      <div>
                        <p className='font-medium'>{reminder.musicTitle}</p>
                        <p className='text-sm text-muted-foreground'>by {reminder.artistName}</p>
                        <p className='text-xs text-muted-foreground'>
                          {new Date(reminder.reminderDate).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className='flex items-center gap-3'>
                      <span
                        className={`text-xs px-2 py-1 rounded ${
                          reminder.isSent
                            ? 'bg-green-100 text-green-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                        {reminder.isSent ? 'Sent' : 'Pending'}
                      </span>
                      <Button
                        type='button'
                        variant='destructive'
                        size='sm'
                        onClick={() => handleDelete(reminder)}
                        disabled={deleteReminderMutation.isPending}
                        aria-label={`Delete reminder for ${reminder.musicTitle}`}>
                        <Trash2 className='w-4 h-4' />
                      </Button>
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <div className='py-8 text-center text-muted-foreground'>
              <p>No music reminders yet.</p>
              <p className='mt-2 text-sm'>Add your first reminder above!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
