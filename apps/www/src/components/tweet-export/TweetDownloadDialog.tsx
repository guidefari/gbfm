import { TweetCardPresentation } from '@gbfm/tweet-card'
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@gbfm/ui'
import { useQuery } from '@tanstack/react-query'
import { Schema } from 'effect'
import { Loader2 } from 'lucide-react'
import { useState } from 'react'
import { apiUrl, fetcher } from '@/lib/http'
import { runAppEffect } from '@/runtime'
import { exportTweetImageEffect } from './export-tweet-image'
import { useCanShareFiles } from './use-can-share-files'
import { usePrerenderedTweetImage } from './use-prerendered-image'

const formats = [
  { key: 'poster', name: 'poster', aspect: 'aspect-[4/5]' },
  { key: 'sleeve', name: 'sleeve', aspect: 'aspect-[9/16]' }
] as const

type FormatKey = (typeof formats)[number]['key']

type Props = {
  readonly slug: string
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
}

const decodePresentation = Schema.decodeUnknownSync(TweetCardPresentation)

export function TweetDownloadDialog({ slug, open, onOpenChange }: Props) {
  const [format, setFormat] = useState<FormatKey>('poster')
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const canShareFiles = useCanShareFiles()
  const {
    data: presentation,
    isPending,
    isError
  } = useQuery({
    queryKey: ['tweet-share-presentation', slug],
    queryFn: async () =>
      decodePresentation(await fetcher(apiUrl(`/content/posts/micro/${slug}/share-presentation`))),
    enabled: open
  })
  const imageUrl = presentation?.images[format] ?? null
  const activeFormat = formats.find((candidate) => candidate.key === format) ?? formats[0]
  const prerendered = usePrerenderedTweetImage({
    enabled: open && Boolean(imageUrl),
    imageUrl,
    slug,
    format
  })

  const exportImage = async () => {
    if (!imageUrl) return
    setExporting(true)
    setError(null)
    try {
      await runAppEffect(
        exportTweetImageEffect({
          imageUrl,
          slug,
          format,
          blob: prerendered.consume()
        })
      )
    } catch {
      setError('image download failed, try again')
    } finally {
      setExporting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='flex max-h-[90dvh] w-[calc(100vw-2rem)] max-w-md flex-col gap-0 overflow-hidden p-0'>
        <DialogHeader className='shrink-0 space-y-1.5 p-4 pb-3 pr-12'>
          <DialogTitle className='font-black'>download for socials</DialogTitle>
          <DialogDescription>the same image used when this tweet link is shared</DialogDescription>
        </DialogHeader>

        <div className='flex shrink-0 gap-2 px-4 pb-3'>
          {formats.map((candidate) => (
            <button
              key={candidate.key}
              type='button'
              onClick={() => setFormat(candidate.key)}
              className={`rounded-sm border px-3 py-1.5 font-mono text-xs font-bold tracking-widest transition-colors ${
                format === candidate.key
                  ? 'border-highlight bg-highlight/10 text-highlight'
                  : 'border-border/60 text-muted-foreground hover:border-border hover:text-foreground'
              }`}>
              {candidate.name}
            </button>
          ))}
        </div>

        <div className='min-h-0 flex-1 overflow-y-auto overscroll-contain px-4'>
          <div
            className={`mx-auto w-full max-w-sm overflow-hidden bg-muted ${activeFormat.aspect}`}>
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={`${format} preview`}
                className='h-full w-full object-contain'
              />
            ) : (
              <div className='flex h-full items-center justify-center text-muted-foreground'>
                {isPending ? <Loader2 className='h-6 w-6 animate-spin' /> : 'preview unavailable'}
              </div>
            )}
          </div>
        </div>

        <div className='shrink-0 space-y-2 border-t border-border/40 p-4'>
          {(error || isError) && (
            <p className='text-base text-destructive'>{error ?? 'preview failed, try again'}</p>
          )}
          <Button
            onClick={exportImage}
            disabled={exporting || isPending || !imageUrl}
            className='w-full'>
            {exporting ? (
              <>
                <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                preparing…
              </>
            ) : canShareFiles ? (
              `share ${format} png`
            ) : (
              `download ${format} png`
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
