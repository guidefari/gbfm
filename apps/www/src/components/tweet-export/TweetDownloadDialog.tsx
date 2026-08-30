import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@gbfm/ui'
import { Loader2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { usePublicProfile } from '@/lib/http'
import { runAppEffect } from '@/runtime'
import { exportTweetImageEffect } from './export-tweet-image'
import { PosterFrame, SleeveFrame } from './frames'
import { buildTweetExportData, type TweetDownloadPost } from './tweet-export-data'
import { useMusicEntity } from './use-music-entity'
import { useCanShareFiles } from './use-can-share-files'
import { usePrerenderedTweetImage } from './use-prerendered-image'

const EXPORT_WIDTH = 540

const formats = [
  { key: 'poster', name: 'poster', Frame: PosterFrame },
  { key: 'sleeve', name: 'sleeve', Frame: SleeveFrame }
] as const

type FormatKey = (typeof formats)[number]['key']

export type { TweetDownloadPost }

type Props = {
  post: TweetDownloadPost
  slug: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function TweetDownloadDialog({ post, slug, open, onOpenChange }: Props) {
  const [format, setFormat] = useState<FormatKey>('poster')
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const exportRef = useRef<HTMLDivElement>(null)

  const primaryCreator = post.creators?.[0]
  const { data: profile } = usePublicProfile(primaryCreator?.username ?? '')
  const { entity, entityType, isPending } = useMusicEntity(
    post.musicEntityType ?? null,
    post.musicEntityId ?? null
  )
  const canShareFiles = useCanShareFiles()

  const data = buildTweetExportData({
    post,
    slug,
    avatarUrl: profile?.image,
    entityType,
    entity
  })

  const ActiveFrame = formats.find((f) => f.key === format)?.Frame ?? PosterFrame

  const renderKey = JSON.stringify([open, format, data])

  const prerendered = usePrerenderedTweetImage({
    enabled: open && !isPending,
    renderKey,
    nodeRef: exportRef,
    frameWidth: EXPORT_WIDTH,
    slug,
    format
  })

  const exportImage = async () => {
    const node = exportRef.current
    if (!node) return

    setExporting(true)
    setError(null)
    try {
      await runAppEffect(
        exportTweetImageEffect({
          node,
          frameWidth: EXPORT_WIDTH,
          slug,
          format,
          blob: prerendered.consume()
        })
      )
    } catch {
      setError('image generation failed, try again')
    } finally {
      setExporting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='flex max-h-[90dvh] w-[calc(100vw-2rem)] max-w-md flex-col gap-0 overflow-hidden p-0'>
        <DialogHeader className='shrink-0 space-y-1.5 p-4 pb-3 pr-12'>
          <DialogTitle className='font-black'>download for socials</DialogTitle>
          <DialogDescription>save this tweet as an image you can post anywhere</DialogDescription>
        </DialogHeader>

        <div className='flex shrink-0 gap-2 px-4 pb-3'>
          {formats.map((f) => (
            <button
              key={f.key}
              type='button'
              onClick={() => setFormat(f.key)}
              className={`rounded-sm border px-3 py-1.5 font-mono text-xs font-bold tracking-widest transition-colors ${
                format === f.key
                  ? 'border-highlight bg-highlight/10 text-highlight'
                  : 'border-border/60 text-muted-foreground hover:border-border hover:text-foreground'
              }`}>
              {f.name}
            </button>
          ))}
        </div>

        <div className='min-h-0 flex-1 overflow-y-auto overscroll-contain px-4'>
          <div className='mx-auto w-full max-w-sm'>
            <ActiveFrame data={data} />
          </div>
        </div>

        <div className='shrink-0 space-y-2 border-t border-border/40 p-4'>
          {error && <p className='text-base text-destructive'>{error}</p>}

          <Button onClick={exportImage} disabled={exporting || isPending} className='w-full'>
            {exporting ? (
              <>
                <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                generating…
              </>
            ) : canShareFiles ? (
              `share ${format} png`
            ) : (
              `download ${format} png`
            )}
          </Button>
        </div>

        {open && (
          <div
            aria-hidden
            className='pointer-events-none fixed left-0 top-0 h-0 w-0 overflow-hidden'>
            <div ref={exportRef} style={{ width: EXPORT_WIDTH }}>
              <ActiveFrame data={data} />
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
