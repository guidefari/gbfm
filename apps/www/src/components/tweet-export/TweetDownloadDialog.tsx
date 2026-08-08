import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@gbfm/ui'
import { toPng } from 'html-to-image'
import { Loader2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { DEFAULT_IMAGE_URL } from '@/lib/constants'
import { usePublicProfile } from '@/lib/http'
import { SITE_URL } from '@/lib/seo'
import { entityLabelByType, useMusicEntity } from './use-music-entity'
import { PosterFrame, SleeveFrame, type TweetExportData } from './frames'

const EXPORT_WIDTH = 540

const isWebKit = () =>
  typeof navigator !== 'undefined' &&
  /AppleWebKit/.test(navigator.userAgent) &&
  !/Chrome\//.test(navigator.userAgent)

const formats = [
  { key: 'poster', name: 'poster', Frame: PosterFrame },
  { key: 'sleeve', name: 'sleeve', Frame: SleeveFrame }
] as const

type FormatKey = (typeof formats)[number]['key']

export type TweetDownloadPost = {
  title: string | null
  createdAt: Date | string | null
  musicEntityType: string | null
  musicEntityId: string | null
  creators?: ReadonlyArray<{ name: string; username: string | null }>
}

type Props = {
  post: TweetDownloadPost
  slug: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function TweetDownloadDialog({ post, slug, open, onOpenChange }: Props) {
  const [format, setFormat] = useState<FormatKey>('poster')
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const exportRef = useRef<HTMLDivElement>(null)

  const primaryCreator = post.creators?.[0]
  const { data: profile } = usePublicProfile(primaryCreator?.username ?? '')
  const { entity, entityType, isPending } = useMusicEntity(
    post.musicEntityType ?? null,
    post.musicEntityId ?? null
  )

  const data: TweetExportData = {
    commentary: post.title ?? '',
    authorName: primaryCreator?.name ?? null,
    username: primaryCreator?.username ?? null,
    avatarUrl: profile?.image || DEFAULT_IMAGE_URL,
    dateLabel: post.createdAt
      ? new Date(post.createdAt).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        })
      : null,
    entityLabel: entityType ? entityLabelByType[entityType] : null,
    entityTitle: entity?.title ?? null,
    entityArtists: entity?.artistNames?.length ? entity.artistNames.join(', ') : null,
    coverImageUrl: entity?.coverImageUrl ?? null,
    url: `${SITE_URL}/tweet/${slug}`
  }

  const ActiveFrame = formats.find((f) => f.key === format)?.Frame ?? PosterFrame

  const download = async () => {
    if (!exportRef.current) return
    setDownloading(true)
    setError(null)
    try {
      const options = {
        pixelRatio: 1080 / EXPORT_WIDTH,
        cacheBust: true
      }
      // WebKit rasterizes the first toPng before embedded images finish
      // decoding, dropping the artwork; warm-up renders work around it
      if (isWebKit()) {
        await toPng(exportRef.current, options)
        await toPng(exportRef.current, options)
      }
      const dataUrl = await toPng(exportRef.current, options)
      const link = document.createElement('a')
      link.href = dataUrl
      link.download = `${slug}-${format}.png`
      link.click()
    } catch {
      setError('image generation failed, try again')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-h-[90vh] overflow-y-auto sm:max-w-md'>
        <DialogHeader>
          <DialogTitle className='font-black'>download for socials</DialogTitle>
          <DialogDescription>save this tweet as an image you can post anywhere</DialogDescription>
        </DialogHeader>

        <div className='flex gap-2'>
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

        <div className='mx-auto w-full max-w-sm'>
          <ActiveFrame data={data} />
        </div>

        {error && <p className='text-base text-destructive'>{error}</p>}

        <Button onClick={download} disabled={downloading || isPending} className='w-full'>
          {downloading ? (
            <>
              <Loader2 className='mr-2 h-4 w-4 animate-spin' />
              generating…
            </>
          ) : (
            `download ${format} png`
          )}
        </Button>

        {open && (
          <div aria-hidden className='pointer-events-none fixed -left-[9999px] top-0'>
            <div ref={exportRef} style={{ width: EXPORT_WIDTH }}>
              <ActiveFrame data={data} />
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
