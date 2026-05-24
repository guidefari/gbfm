import { useFeatureFlag } from '@gbfm/core/feature-flags'
import {
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  useToast
} from '@gbfm/ui'
import type { SelectMdxCompiledAudio } from '@gbfm/vps/schemas'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import {
  ArrowLeft,
  Edit,
  ListPlus,
  Loader2,
  MoreHorizontal,
  QrCode,
  Share2,
  Tag
} from 'lucide-react'
import * as React from 'react'
import { GiPauseButton, GiPlayButton } from 'react-icons/gi'
import { FavoriteButton } from '@/components/FavoriteButton'
import { MDXRendrr } from '@/components/MDXRendrr'
import { RouteError } from '@/components/RouteError'
import { useSession } from '@/lib/auth-client'
import { DEFAULT_IMAGE_URL } from '@/lib/constants'
import { fetcher, useMixQRPdf, useShowById, VPS_BASE_URL } from '@/lib/http'
import { getShareUrl } from '@/lib/share'
import { useContentStore } from '@/store'
import { useAudioPlayerActions, useAudioPlayerState } from '@/store/audioPlayer'

export const Route = createFileRoute('/mixes/$mixId')({
  component: MixPage,
  errorComponent: ({ error }) => <RouteError error={error} />,
  loader: async ({ params }) => {
    const mix = await fetcher<SelectMdxCompiledAudio>(
      `${VPS_BASE_URL}/content/audio/mix/${params.mixId}`
    )
    return { mix }
  },
  head: ({ loaderData, params }) => {
    const siteUrl = 'https://goosebumps.fm'
    const mixUrl = `${siteUrl}/mixes/${params.mixId}`
    const mix = loaderData?.mix

    const title = mix?.title || params.mixId
    const description =
      mix?.description || `Listen to ${title} on goosebumps.fm`
    const image =
      mix?.thumbnailUrl ||
      'https://d20tmfka7s58bt.cloudfront.net/gb-default.png'

    return {
      meta: [
        {
          title: `${title} | goosebumps.fm`
        },
        {
          name: 'description',
          content: description
        },
        {
          property: 'og:type',
          content: 'music.song'
        },
        {
          property: 'og:title',
          content: `${title} | goosebumps.fm`
        },
        {
          property: 'og:description',
          content: description
        },
        {
          property: 'og:url',
          content: mixUrl
        },
        {
          property: 'og:site_name',
          content: 'goosebumps.fm'
        },
        {
          property: 'og:image',
          content: image
        },
        {
          property: 'og:image:width',
          content: '1200'
        },
        {
          property: 'og:image:height',
          content: '630'
        },
        {
          property: 'og:audio',
          content: mix?.url || ''
        },
        {
          name: 'twitter:card',
          content: 'summary_large_image'
        },
        {
          name: 'twitter:title',
          content: `${title} | goosebumps.fm`
        },
        {
          name: 'twitter:description',
          content: description
        },
        {
          name: 'twitter:image',
          content: image
        }
      ]
    }
  }
})

function MixPage() {
  const { mixId } = Route.useParams()
  const { setCurrentContent } = useContentStore()
  const { mix } = Route.useLoaderData()

  React.useEffect(() => {
    if (mix?.creators) {
      const contentInfo = {
        id: mixId,
        archetype: 'mix',
        creatorIds: mix.creators.map((creator) => creator.id)
      }
      setCurrentContent(contentInfo)
    }

    return () => setCurrentContent(null)
  }, [mix, mixId, setCurrentContent])

  if (!mix) return <div>No data</div>

  return (
    <div className='max-w-3xl px-4 py-6 mx-auto'>
      <Link
        to='/mixes'
        className='inline-flex items-center gap-1 mb-8 text-sm transition-colors text-muted-foreground hover:text-foreground'>
        <ArrowLeft className='w-4 h-4' />
        Mixes
      </Link>
      <MixDetails mix={mix} />
    </div>
  )
}

type MixAction =
  | { key: string; label: string; icon: React.ReactNode; onClick: () => void }
  | { key: string; component: React.ReactNode }

const MAX_INLINE_ACTIONS = 1

function MixActionBar({ actions }: { actions: MixAction[] }) {
  const inlineActions = actions.slice(0, MAX_INLINE_ACTIONS)
  const overflowActions = actions.slice(MAX_INLINE_ACTIONS)
  const hasOverflow = overflowActions.length > 0

  return (
    <div className='flex items-center gap-2'>
      {inlineActions.map((action) =>
        'component' in action ? (
          <React.Fragment key={action.key}>{action.component}</React.Fragment>
        ) : (
          <Button
            key={action.key}
            onClick={action.onClick}
            variant='outline'
            size='lg'
            className='w-12 h-12 p-0 rounded-none shadow-sm hover:shadow-md active:scale-95'
            title={action.label}>
            {action.icon}
          </Button>
        )
      )}

      {hasOverflow && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant='outline'
              size='lg'
              className='w-12 h-12 p-0 rounded-none shadow-sm hover:shadow-md active:scale-95'
              title='More actions'>
              <MoreHorizontal className='w-5 h-5' />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align='end'>
            {overflowActions.map((action) =>
              'component' in action ? (
                <React.Fragment key={action.key}>
                  {action.component}
                </React.Fragment>
              ) : (
                <DropdownMenuItem key={action.key} onClick={action.onClick}>
                  {action.icon}
                  <span>{action.label}</span>
                </DropdownMenuItem>
              )
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )
}

function MixDetails({ mix }: { mix: SelectMdxCompiledAudio }) {
  const isQueueEnabled = useFeatureFlag('ui.queue')
  const isShareEnabled = useFeatureFlag('ui.share')
  const { data: session } = useSession()
  const user = session?.user
  const { toast } = useToast()
  const navigate = useNavigate()
  const isAdmin = user?.role === 'admin'
  const isCreator = user?.role === 'creator'
  const canDownloadQr = isAdmin || isCreator
  const { isPlaying, nowPlayingContext } = useAudioPlayerState()
  const { loadTrack, togglePlayPause, addToQueue } = useAudioPlayerActions()
  const { data: show } = useShowById(mix.showId)

  const isActive = nowPlayingContext?.title === mix.title

  const handlePlayClick = () => {
    if (isActive) {
      togglePlayPause()
    } else {
      loadTrack(
        mix.url,
        mix.thumbnailUrl || DEFAULT_IMAGE_URL,
        mix.title,
        mix.id,
        mix.creators,
        mix.slug
      )
    }
  }

  const handleAddToQueue = () => {
    addToQueue(mix)
    toast({
      title: 'Added to queue',
      description: mix.title,
      duration: 2000
    })
  }

  const handleShare = async () => {
    const shareUrl = getShareUrl('mix', mix.slug)
    try {
      await navigator.clipboard.writeText(shareUrl)
      toast({
        title: 'Link copied!',
        description: 'Share URL copied to clipboard'
      })
    } catch {
      toast({
        title: 'Failed to copy',
        description: 'Could not copy link to clipboard',
        variant: 'destructive'
      })
    }
  }

  const handleEdit = () => {
    navigate({
      to: '/mix-upload',
      search: {
        edit: mix.slug,
        title: mix.title,
        description: mix.description || '',
        content: mix.content || '',
        thumbnailUrl: mix.thumbnailUrl || '',
        tags: mix.tags || []
      }
    })
  }

  const [qrEnabled, setQrEnabled] = React.useState(false)
  const { data: qrPdf, isFetching: isGeneratingPdf } = useMixQRPdf(
    mix.slug,
    qrEnabled
  )

  React.useEffect(() => {
    if (qrPdf?.url && qrEnabled) {
      window.open(qrPdf.url, '_blank')
      setQrEnabled(false)
    }
  }, [qrPdf, qrEnabled])

  const handleDownloadQR = () => {
    setQrEnabled(true)
    toast({
      title: 'Generating PDF...',
      description: 'Your QR code PDF will download shortly',
      duration: 3000
    })
  }

  const actions: MixAction[] = [
    {
      key: 'favorite',
      component: (
        <FavoriteButton
          contentType='mix'
          contentId={mix.id}
          contentTitle={mix.title}
          variant='outline'
          size='lg'
          className='w-12 h-12 p-0 rounded-none shadow-sm hover:shadow-md active:scale-95'
        />
      )
    },
    ...(isQueueEnabled
      ? [
          {
            key: 'queue',
            label: 'Add to queue',
            icon: <ListPlus className='w-5 h-5' />,
            onClick: handleAddToQueue
          }
        ]
      : []),
    ...(isShareEnabled
      ? [
          {
            key: 'share',
            label: 'Share',
            icon: <Share2 className='w-4 h-4' />,
            onClick: handleShare
          }
        ]
      : []),
    ...(canDownloadQr
      ? [
          {
            key: 'qr-code',
            label: 'Download QR',
            icon: isGeneratingPdf ? (
              <Loader2 className='w-4 h-4 animate-spin' />
            ) : (
              <QrCode className='w-4 h-4' />
            ),
            onClick: handleDownloadQR
          }
        ]
      : []),
    ...(isAdmin
      ? [
          {
            key: 'edit',
            label: 'Edit',
            icon: <Edit className='w-4 h-4' />,
            onClick: handleEdit
          }
        ]
      : [])
  ]

  return (
    <div className='space-y-8'>
      <div className='flex flex-col items-start gap-8 md:flex-row'>
        {/* Left Column: Image and Play Button */}
        <div className='shrink-0 w-full space-y-4 md:w-64'>
          <div className='relative group'>
            <img
              src={mix.thumbnailUrl || DEFAULT_IMAGE_URL}
              alt={mix.title}
              className='object-cover w-full border rounded-sm shadow-lg aspect-square border-border'
            />
          </div>

          <div className='flex gap-2'>
            <Button
              onClick={handlePlayClick}
              size='lg'
              className='flex-1 h-12 text-base font-bold tracking-widest uppercase transition-all rounded-none shadow-sm hover:shadow-md active:scale-95'>
              {isActive && isPlaying ? (
                <>
                  <GiPauseButton className='mr-2 text-xl' />
                  Pause
                </>
              ) : (
                <>
                  <GiPlayButton className='mr-2 text-xl' />
                  Play
                </>
              )}
            </Button>
            <MixActionBar actions={actions} />
          </div>

          {mix.tags && mix.tags.length > 0 && (
            <div className='flex flex-wrap gap-2'>
              {mix.tags.map((tag) => (
                <Badge
                  key={tag}
                  variant='secondary'
                  className='text-[10px] uppercase tracking-widest px-2 py-1 rounded-none font-bold bg-muted/50 text-muted-foreground border-none'>
                  <Tag className='w-3 h-3 mr-1 opacity-50' />
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Metadata */}
        <div className='flex-1 pt-2 space-y-6'>
          <div className='space-y-4'>
            <div className='flex flex-col gap-2'>
              <h1 className='text-4xl font-black leading-none tracking-tighter uppercase md:text-5xl'>
                {mix.title}
              </h1>
              {mix.creators && mix.creators.length > 0 && (
                <div className='flex flex-wrap gap-x-1.5 gap-y-1 text-xs font-bold uppercase tracking-widest text-muted-foreground/80'>
                  <span className='opacity-50'>by</span>
                  {mix.creators.map((creator, index) => (
                    <React.Fragment key={creator.id}>
                      <Link
                        to='/profile/$username'
                        params={{ username: creator.username || '' }}
                        className='transition-colors hover:text-primary'>
                        {creator.name}
                      </Link>
                      {index < (mix.creators?.length || 0) - 1 && (
                        <span className='opacity-30'>&</span>
                      )}
                    </React.Fragment>
                  ))}
                </div>
              )}
              {show && (
                <div className='flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-muted-foreground/80'>
                  <span className='opacity-50'>from</span>
                  <Link
                    to='/shows/$showSlug'
                    params={{ showSlug: show.slug }}
                    className='transition-colors hover:text-primary'>
                    {show.title}
                  </Link>
                </div>
              )}
            </div>
            {mix.description && (
              <p className='pl-4 text-xl italic font-medium leading-relaxed border-l-2 text-muted-foreground border-border/50'>
                {mix.description}
              </p>
            )}
            {mix.createdAt && (
              <p className='font-mono text-sm text-muted-foreground/60'>
                {new Date(mix.createdAt).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className='pt-8 border-t border-border/50'>
        <div className='prose prose-base dark:prose-invert max-w-none prose-headings:uppercase prose-headings:font-black prose-headings:tracking-tighter prose-p:leading-relaxed prose-a:text-foreground prose-a:underline'>
          <MDXRendrr mdxString={mix.compiledContent ?? mix.content} />
        </div>
      </div>
    </div>
  )
}
