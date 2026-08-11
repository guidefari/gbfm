import { LINK_STATUS } from '@gbfm/core/status'
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
import { queryOptions, useQuery } from '@tanstack/react-query'
import { Bell, Music4 } from 'lucide-react'
import { useState } from 'react'
import { StreamLinks } from '@/components/StreamLinks'
import { useSession } from '@/lib/auth-client'
import { apiUrl, fetcher, useCreateMusicReminder } from '@/lib/http'
import { log } from '@/services/logger'

type MusicEntityType = 'album' | 'track' | 'playlist'

type MusicEntityPreview = {
  id: string
  title: string
  coverImageUrl: string | null
  slug: string
  artistNames?: string[] | null
  description?: string | null
}

type EntityLink = {
  id: string
  platform: string
  url: string
  status: string
}

const entityPathByType: Record<MusicEntityType, string> = {
  album: 'albums',
  track: 'tracks',
  playlist: 'playlists'
}

const entityLabelByType: Record<MusicEntityType, string> = {
  album: 'Album',
  track: 'Track',
  playlist: 'Playlist'
}

type Props = {
  entityType: string
  entityId: string
}

export function isMusicEntityType(value: string): value is MusicEntityType {
  return value === 'album' || value === 'track' || value === 'playlist'
}

export const musicEntityQueryOptions = (entityType: string, entityId: string) =>
  queryOptions({
    queryKey: ['music-entity', entityType, entityId],
    queryFn: () => {
      if (!isMusicEntityType(entityType)) throw new Error('Unsupported music entity type')
      return fetcher<MusicEntityPreview>(
        apiUrl(`/music/${entityPathByType[entityType]}/${entityId}`)
      )
    }
  })

export const musicEntityLinksQueryOptions = (entityType: string, entityId: string) =>
  queryOptions({
    queryKey: ['music-entity-links', entityType, entityId],
    queryFn: () => {
      if (!isMusicEntityType(entityType)) throw new Error('Unsupported music entity type')
      return fetcher<EntityLink[]>(apiUrl(`/music/${entityType}/${entityId}/links?status=verified`))
    }
  })

export function TweetMusicEntityCard({ entityType, entityId }: Props) {
  const supportedType: MusicEntityType | null = isMusicEntityType(entityType) ? entityType : null
  const { data: session } = useSession()
  const isAuthenticated = Boolean(session?.user)

  const { data, isPending } = useQuery({
    ...musicEntityQueryOptions(entityType, entityId),
    enabled: Boolean(supportedType && entityId)
  })

  // todo: we can probs consolidate this into the music entity query above
  const { data: links, isPending: isLinksPending } = useQuery({
    ...musicEntityLinksQueryOptions(entityType, entityId),
    enabled: Boolean(supportedType && entityId)
  })

  if (!supportedType) {
    return null
  }

  if (isPending || isLinksPending) {
    return (
      <div className='not-prose overflow-hidden rounded-md border border-border/50 bg-muted/20 animate-pulse sm:flex'>
        <div className='aspect-square w-full bg-muted sm:h-40 sm:w-40 sm:shrink-0' />
        <div className='space-y-2 p-4'>
          <div className='h-2.5 w-16 rounded-full bg-muted' />
          <div className='h-4 w-2/3 rounded-full bg-muted' />
          <div className='h-3 w-1/3 rounded-full bg-muted' />
        </div>
      </div>
    )
  }

  if (!data) {
    return null
  }

  const verifiedLinks = links?.filter((l) => l.status === LINK_STATUS.VERIFIED) ?? []

  return (
    <section className='not-prose overflow-hidden rounded-md border border-border/50 bg-muted/20 sm:flex sm:items-stretch'>
      <div className='flex aspect-square w-full shrink-0 items-center justify-center overflow-hidden bg-muted sm:h-auto sm:w-40'>
        {data.coverImageUrl ? (
          <img
            src={data.coverImageUrl}
            alt={data.title}
            className='h-full w-full object-cover'
            loading='lazy'
          />
        ) : (
          <Music4 className='h-12 w-12 text-muted-foreground/70' />
        )}
      </div>

      <div className='flex min-w-0 flex-1 flex-col'>
        <div className='flex items-start justify-between gap-2 p-4'>
          <div className='space-y-1'>
            <div className='text-[10px] font-bold tracking-[0.3em] text-muted-foreground/60'>
              {entityLabelByType[supportedType]}
            </div>
            <h2 className='text-lg font-bold leading-snug tracking-tight text-foreground'>
              {data.title}
            </h2>
            {data.artistNames?.length ? (
              <p className='text-base text-muted-foreground'>{data.artistNames.join(', ')}</p>
            ) : null}
          </div>

          {isAuthenticated && (
            <RemindMeButton
              title={data.title}
              artistNames={data.artistNames}
              coverImageUrl={data.coverImageUrl}
              musicUrl={verifiedLinks[0]?.url ?? null}
            />
          )}
        </div>

        {data.description ? (
          <p className='border-t border-border/40 px-4 py-2 text-xs leading-relaxed text-muted-foreground'>
            {data.description}
          </p>
        ) : null}

        {verifiedLinks.length > 0 && (
          <div className='-mx-4 mt-auto overflow-x-auto border-t border-border/40 px-4 py-3 sm:mx-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'>
            <div className='w-max'>
              <StreamLinks links={verifiedLinks} />
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

function RemindMeButton({
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
            <label htmlFor='reminder-date' className='mb-1 block text-base font-medium'>
              Remind me on
            </label>
            <Input
              type='datetime-local'
              id='reminder-date'
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
