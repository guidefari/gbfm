import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  useToast
} from '@gbfm/ui'
import { Bell } from 'lucide-react'
import { useId, useState } from 'react'
import { useCreateMusicReminder } from '@/lib/http'
import { log } from '@/services/logger'

export function RemindMeButton({
  title,
  artistNames,
  coverImageUrl,
  musicUrl
}: {
  title: string
  artistNames?: string[] | null
  coverImageUrl: string | null
  musicUrl: string | null
}) {
  const dateId = useId()
  const [open, setOpen] = useState(false)
  const [reminderDate, setReminderDate] = useState('')
  const { toast } = useToast()
  const createReminderMutation = useCreateMusicReminder()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!musicUrl || !reminderDate) return

    try {
      await createReminderMutation.mutateAsync({
        musicTitle: title,
        artistName: artistNames?.join(', ') || 'Unknown artist',
        musicUrl,
        albumCoverUrl: coverImageUrl ?? undefined,
        reminderDate: new Date(reminderDate).toISOString()
      })
      toast({
        title: 'Reminder created',
        description: "We'll send you an email when the time comes!"
      })
      setOpen(false)
      setReminderDate('')
    } catch (error) {
      log('error', 'Failed to create reminder', { error })
      toast({
        variant: 'destructive',
        title: 'Failed to create reminder',
        description: 'Please try again later.'
      })
    }
  }

  if (!musicUrl) return null

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        type='button'
        variant='outline'
        size='sm'
        className='shrink-0 gap-1.5 rounded-sm'
        onClick={() => setOpen(true)}>
        <Bell className='h-3.5 w-3.5' />
        Remind me
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Set a listen reminder</DialogTitle>
        </DialogHeader>
        <form className='space-y-4' onSubmit={handleSubmit}>
          <div>
            <label htmlFor={dateId} className='mb-1 block text-base font-medium'>
              Remind me on
            </label>
            <Input
              type='datetime-local'
              id={dateId}
              required
              value={reminderDate}
              onChange={(e) => setReminderDate(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type='submit' disabled={createReminderMutation.isPending}>
              {createReminderMutation.isPending ? 'Saving…' : 'Set reminder'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
