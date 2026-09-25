import { useFeatureFlag } from '@gbfm/core/feature-flags'
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  toast
} from '@gbfm/ui'
import { QueryClientProvider } from '@tanstack/react-query'
import { Edit, ListPlus, Loader2, MoreHorizontal, Pause, Play, QrCode, Share2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { FavoriteButton } from '@/components/FavoriteButton'
import { useSession } from '@/lib/auth-client'
import { useMixQRPdf } from '@/lib/http'
import { queryClient } from '@/lib/query-client'
import { getShareUrl } from '@/lib/share'
import {
  PlayerProvider,
  useNowPlayingTrack,
  usePlayerActions,
  useTransport
} from '@/services/player'
import { toQueueTrack, type PlayableAudio } from '@/services/player/toQueueTrack'

interface Props {
  readonly mix: PlayableAudio & {
    readonly description?: string | null
    readonly content?: string | null
    readonly tags?: readonly string[] | null
  }
}

function Actions({ mix }: Props) {
  const queueEnabled = useFeatureFlag('ui.queue')
  const shareEnabled = useFeatureFlag('ui.share')
  const { data: session } = useSession()
  const isAdmin = session?.user?.role === 'admin'
  const canDownloadQr = isAdmin || session?.user?.role === 'creator'
  const currentTrack = useNowPlayingTrack()
  const { isPlaying } = useTransport()
  const { playTrack, togglePlayPause, enqueue } = usePlayerActions()
  const isActive = currentTrack?.id === mix.id
  const [qrEnabled, setQrEnabled] = useState(false)
  const { data: qrPdf, isFetching: isGeneratingPdf } = useMixQRPdf(mix.slug, qrEnabled)

  useEffect(() => {
    if (!qrPdf?.url || !qrEnabled) return
    window.open(qrPdf.url, '_blank')
    setQrEnabled(false)
  }, [qrPdf, qrEnabled])

  const editHref = `/mix-upload?${new URLSearchParams({
    edit: mix.slug,
    title: mix.title,
    description: mix.description ?? '',
    content: mix.content ?? '',
    thumbnailUrl: mix.thumbnailUrl ?? '',
    tags: mix.tags?.join(',') ?? ''
  })}`

  return (
    <div className='flex gap-2'>
      <Button
        onClick={() => (isActive ? togglePlayPause() : playTrack(toQueueTrack(mix)))}
        size='lg'
        className='h-12 flex-1 rounded-none text-base font-bold tracking-widest shadow-sm transition-all hover:shadow-md active:scale-95'>
        {isActive && isPlaying ? <Pause className='mr-2' /> : <Play className='mr-2' />}
        {isActive && isPlaying ? 'Pause' : 'Play'}
      </Button>
      <FavoriteButton
        contentType='mix'
        contentId={mix.id}
        contentTitle={mix.title}
        variant='outline'
        size='lg'
        className='h-12 w-12 rounded-none p-0 shadow-sm hover:shadow-md active:scale-95'
      />
      {(queueEnabled || shareEnabled || canDownloadQr || isAdmin) && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant='outline'
              size='lg'
              className='h-12 w-12 rounded-none p-0'
              title='More actions'>
              <MoreHorizontal className='h-5 w-5' />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align='end'>
            {queueEnabled && (
              <DropdownMenuItem
                onClick={() => {
                  enqueue(toQueueTrack(mix))
                  toast({ title: 'Added to queue', description: mix.title, duration: 2000 })
                }}>
                <ListPlus className='h-5 w-5' /> Add to queue
              </DropdownMenuItem>
            )}
            {shareEnabled && (
              <DropdownMenuItem
                onClick={() =>
                  void navigator.clipboard.writeText(getShareUrl('mix', mix.slug)).then(
                    () =>
                      toast({
                        title: 'Link copied!',
                        description: 'Share URL copied to clipboard'
                      }),
                    () =>
                      toast({
                        title: 'Failed to copy',
                        description: 'Could not copy link to clipboard',
                        variant: 'destructive'
                      })
                  )
                }>
                <Share2 className='h-4 w-4' /> Share
              </DropdownMenuItem>
            )}
            {canDownloadQr && (
              <DropdownMenuItem
                onClick={() => {
                  setQrEnabled(true)
                  toast({
                    title: 'Generating PDF...',
                    description: 'Your QR code PDF will download shortly',
                    duration: 3000
                  })
                }}>
                {isGeneratingPdf ? (
                  <Loader2 className='h-4 w-4 animate-spin' />
                ) : (
                  <QrCode className='h-4 w-4' />
                )}{' '}
                Download QR
              </DropdownMenuItem>
            )}
            {isAdmin && (
              <DropdownMenuItem asChild>
                <a href={editHref}>
                  <Edit className='h-4 w-4' /> Edit
                </a>
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )
}

export function MixActions(props: Props) {
  return (
    <QueryClientProvider client={queryClient}>
      <PlayerProvider>
        <Actions {...props} />
      </PlayerProvider>
    </QueryClientProvider>
  )
}
