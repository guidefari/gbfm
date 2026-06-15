import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  toast
} from '@gbfm/ui'
import { Disc3, Loader2, MailCheck, Send } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useSession } from '@/lib/auth-client'
import { useAdminNewsletterSubscribers, useSendMixNotification } from '@/lib/http'
import { useAdminOverview } from '../-overview.data'

type SendableMix = {
  id: string
  slug: string
  title: string
  createdAt: string
}

function formatCount(value: number) {
  return new Intl.NumberFormat('en-US').format(value)
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}

export function NewsletterTab() {
  const { data, isPending, isError } = useAdminNewsletterSubscribers()
  const overview = useAdminOverview()
  const { data: session } = useSession()
  const adminEmail = session?.user?.email ?? null
  const sendMix = useSendMixNotification()

  const mixes = useMemo<SendableMix[]>(() => {
    const items = overview.data?.publishing.recentContent ?? []

    return items
      .flatMap((item) =>
        item.draft || item.type !== 'mix'
          ? []
          : [
              {
                id: item.id,
                slug: item.slug,
                title: item.title ?? item.slug,
                createdAt: item.createdAt
              }
            ]
      )
      .slice(0, 8)
  }, [overview.data])

  const [selectedMixId, setSelectedMixId] = useState<string | null>(null)
  const selectedMix = mixes.find((mix) => mix.id === selectedMixId) ?? mixes[0] ?? null
  const [artistName, setArtistName] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)

  if (isPending) {
    return <p className='text-sm text-muted-foreground'>Loading...</p>
  }

  if (isError) {
    return <p className='text-sm text-destructive'>Failed to load subscribers.</p>
  }

  const subscribers = data?.subscribers ?? []
  const activeSubscribers = subscribers.filter((sub) => !sub.unsubscribedAt)
  const unsubscribedCount = subscribers.length - activeSubscribers.length
  const newLast30Days = overview.data?.community.newsletter.newLast30Days ?? 0
  const recentSubscribers = overview.data?.community.recentSubscribers.slice(0, 5) ?? []

  function buildMetadata() {
    const trimmedArtist = artistName.trim()
    return trimmedArtist ? { artistName: trimmedArtist } : undefined
  }

  function handleTestSend() {
    if (!selectedMix || !adminEmail) return

    sendMix.mutate(
      { mixSlug: selectedMix.slug, recipients: [adminEmail], metadata: buildMetadata() },
      {
        onSuccess: (result) =>
          toast({ title: 'Test sent', description: `Sent to ${adminEmail}. ${result.message}` }),
        onError: (error) =>
          toast({ title: 'Test send failed', description: error.message, variant: 'destructive' })
      }
    )
  }

  function handleBroadcast() {
    if (!selectedMix) return

    sendMix.mutate(
      { mixSlug: selectedMix.slug, metadata: buildMetadata() },
      {
        onSuccess: (result) =>
          toast({
            title: `Sent to ${result.sentTo.length} subscriber${result.sentTo.length === 1 ? '' : 's'}`,
            description: result.message
          }),
        onError: (error) =>
          toast({ title: 'Send failed', description: error.message, variant: 'destructive' })
      }
    )
    setConfirmOpen(false)
  }

  return (
    <div className='space-y-6'>
      <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-4'>
        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-sm text-muted-foreground'>Active subscribers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className='text-3xl font-black tracking-tight'>
              {formatCount(activeSubscribers.length)}
            </div>
            <p className='mt-2 text-sm text-muted-foreground'>
              Audience currently able to receive sends.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-sm text-muted-foreground'>New in 30 days</CardTitle>
          </CardHeader>
          <CardContent>
            <div className='text-3xl font-black tracking-tight'>{formatCount(newLast30Days)}</div>
            <p className='mt-2 text-sm text-muted-foreground'>
              Recent list growth from the existing funnel.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-sm text-muted-foreground'>Unsubscribed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className='text-3xl font-black tracking-tight'>
              {formatCount(unsubscribedCount)}
            </div>
            <p className='mt-2 text-sm text-muted-foreground'>
              Useful for measuring churn once campaigns land.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-sm text-muted-foreground'>Sendable mixes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className='text-3xl font-black tracking-tight'>{formatCount(mixes.length)}</div>
            <p className='mt-2 text-sm text-muted-foreground'>
              Recently published mixes ready to announce.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <Send className='h-4 w-4' />
            Send a new mix notification
          </CardTitle>
        </CardHeader>
        <CardContent className='space-y-5'>
          <p className='text-sm text-muted-foreground'>
            Pick a recently published mix and email every opted-in subscriber. Send a test to
            yourself first to preview the email.
          </p>

          {mixes.length === 0 ? (
            <p className='text-sm text-muted-foreground'>
              No published mixes available yet. Upload and publish a mix to announce it here.
            </p>
          ) : (
            <div className='grid gap-3 md:grid-cols-2'>
              {mixes.map((mix) => {
                const isSelected = selectedMix?.id === mix.id

                return (
                  <button
                    key={mix.id}
                    type='button'
                    onClick={() => setSelectedMixId(mix.id)}
                    className={`rounded-lg border p-4 text-left transition ${
                      isSelected ? 'border-foreground bg-muted/50' : 'hover:bg-muted/40'
                    }`}>
                    <div className='flex items-center gap-2 text-sm text-muted-foreground'>
                      <Disc3 className='h-4 w-4' />
                      <span>Mix</span>
                      <span>•</span>
                      <span>{formatDate(mix.createdAt)}</span>
                    </div>
                    <div className='mt-2 font-semibold'>{mix.title}</div>
                    <div className='mt-1 text-sm text-muted-foreground'>/mixes/{mix.slug}</div>
                  </button>
                )
              })}
            </div>
          )}

          <div className='grid gap-2 sm:max-w-sm'>
            <Label htmlFor='newsletter-artist'>Artist name (optional)</Label>
            <Input
              id='newsletter-artist'
              value={artistName}
              onChange={(e) => setArtistName(e.target.value)}
              placeholder='Guide Fari'
            />
            <p className='text-xs text-muted-foreground'>
              Shown in the email body. Defaults to Guide Fari when left blank.
            </p>
          </div>

          {selectedMix && (
            <div className='rounded-lg border bg-muted/30 p-4 text-sm'>
              <div className='flex items-center gap-2 font-medium'>
                <MailCheck className='h-4 w-4' />
                Email preview
              </div>
              <div className='mt-3 space-y-1'>
                <p>
                  <span className='text-muted-foreground'>Subject:</span> New mix:{' '}
                  {selectedMix.title}
                </p>
                <p>
                  <span className='text-muted-foreground'>Artist:</span>{' '}
                  {artistName.trim() || 'Guide Fari'}
                </p>
                <p>
                  <span className='text-muted-foreground'>Link:</span> /mixes/{selectedMix.slug}
                </p>
              </div>
            </div>
          )}

          <div className='flex flex-wrap items-center gap-2'>
            <Button
              type='button'
              onClick={() => setConfirmOpen(true)}
              disabled={!selectedMix || sendMix.isPending}>
              {sendMix.isPending ? (
                <Loader2 className='h-4 w-4 animate-spin' />
              ) : (
                <Send className='h-4 w-4' />
              )}
              Send to {formatCount(activeSubscribers.length)} subscriber
              {activeSubscribers.length === 1 ? '' : 's'}
            </Button>
            <Button
              type='button'
              variant='outline'
              onClick={handleTestSend}
              disabled={!selectedMix || !adminEmail || sendMix.isPending}>
              Test send to me
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className='grid gap-4 xl:grid-cols-[1.1fr_1.4fr]'>
        <Card>
          <CardHeader>
            <CardTitle>Recent Subscriber Activity</CardTitle>
          </CardHeader>
          <CardContent className='space-y-3'>
            {overview.isPending ? (
              <p className='text-sm text-muted-foreground'>Loading subscriber activity...</p>
            ) : overview.isError ? (
              <p className='text-sm text-destructive'>Failed to load subscriber activity.</p>
            ) : recentSubscribers.length === 0 ? (
              <p className='text-sm text-muted-foreground'>No recent subscriber activity yet.</p>
            ) : (
              recentSubscribers.map((sub) => (
                <div
                  key={sub.id}
                  className='flex items-center justify-between gap-4 border-b pb-3 last:border-0 last:pb-0'>
                  <div className='min-w-0'>
                    <div className='truncate font-medium'>{sub.email}</div>
                    <div className='text-sm text-muted-foreground'>
                      {sub.source ?? 'unknown source'}
                    </div>
                  </div>
                  <div className='shrink-0 text-sm text-muted-foreground'>
                    {formatDate(sub.createdAt)}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              Audience table
              <span className='ml-2 text-sm font-normal text-muted-foreground'>
                {subscribers.length} subscriber{subscribers.length !== 1 ? 's' : ''}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className='overflow-x-auto'>
              <table className='w-full text-sm'>
                <thead>
                  <tr className='border-b text-left text-muted-foreground'>
                    <th className='pb-2 pr-4 font-medium'>Email</th>
                    <th className='pb-2 pr-4 font-medium'>Name</th>
                    <th className='pb-2 pr-4 font-medium'>Source</th>
                    <th className='pb-2 pr-4 font-medium'>Status</th>
                    <th className='pb-2 font-medium'>Subscribed</th>
                  </tr>
                </thead>
                <tbody>
                  {subscribers.map((sub) => (
                    <tr key={sub.id} className='border-b last:border-0'>
                      <td className='py-2 pr-4'>{sub.email}</td>
                      <td className='py-2 pr-4 text-muted-foreground'>{sub.name ?? '-'}</td>
                      <td className='py-2 pr-4 text-muted-foreground'>{sub.source ?? '-'}</td>
                      <td className='py-2 pr-4'>
                        {sub.unsubscribedAt ? (
                          <Badge variant='destructive'>Unsubscribed</Badge>
                        ) : (
                          <Badge variant='secondary'>Active</Badge>
                        )}
                      </td>
                      <td className='py-2 text-muted-foreground'>
                        {new Date(sub.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send mix notification?</DialogTitle>
            <DialogDescription>
              This emails <span className='font-medium'>{selectedMix?.title}</span> to every
              opted-in subscriber. Recipients who have turned off mix emails are skipped
              automatically. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant='outline' onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleBroadcast} disabled={sendMix.isPending}>
              {sendMix.isPending ? <Loader2 className='h-4 w-4 animate-spin' /> : null}
              Send now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
