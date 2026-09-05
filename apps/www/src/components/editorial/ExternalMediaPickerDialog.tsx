import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input
} from '@gbfm/ui'
import { useState, type FormEvent } from 'react'
import {
  bandcampOembedUrl,
  externalMediaMarkdown,
  externalMediaProviders,
  parseBandcampOembedJson,
  parseExternalMediaUrl,
  type ExternalMediaParseResult,
  type ExternalMediaReference
} from './external-media'

export type ExternalMediaPickerDialogProps = {
  readonly portalContainer?: HTMLElement | null
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly onInsert: (markdown: string) => void
}

export function ExternalMediaPickerDialog({
  open,
  portalContainer,
  onOpenChange,
  onInsert
}: ExternalMediaPickerDialogProps) {
  const [url, setUrl] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isResolving, setIsResolving] = useState(false)

  const close = () => {
    setUrl('')
    setError(null)
    onOpenChange(false)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const parsed = parseExternalMediaUrl(url)
    if (!parsed.ok) {
      setError(parsed.message)
      return
    }

    if (parsed.media.provider === externalMediaProviders.spotify) {
      setError('Paste Spotify links directly into the story to add them to the GBFM catalog.')
      return
    }

    setError(null)
    setIsResolving(true)
    const resolved = await resolveBandcampMedia(parsed.media)
    setIsResolving(false)

    if (!resolved.ok) {
      setError(resolved.message)
      return
    }

    onInsert(`\n${externalMediaMarkdown(resolved.media)}\n`)
    close()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        container={portalContainer}
        className='w-[calc(100vw-2rem)] max-w-md overflow-hidden'>
        <DialogHeader>
          <DialogTitle>Embed external media</DialogTitle>
          <DialogDescription className='text-sm leading-relaxed'>
            Paste a SoundCloud, Bandcamp, or YouTube link. GBFM creates the player for you.
          </DialogDescription>
        </DialogHeader>
        <form className='space-y-4' onSubmit={handleSubmit}>
          <div className='space-y-2'>
            <label htmlFor='external-media-url' className='text-sm font-medium'>
              Media URL
            </label>
            <Input
              id='external-media-url'
              type='url'
              required
              autoComplete='url'
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder='https://...'
              aria-describedby={error === null ? undefined : 'external-media-url-error'}
              aria-invalid={error === null ? undefined : true}
            />
            {error === null ? null : (
              <p id='external-media-url-error' role='alert' className='text-sm text-destructive'>
                {error}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button type='button' variant='outline' onClick={close} className='h-9 px-4 text-sm'>
              Cancel
            </Button>
            <Button type='submit' disabled={isResolving} className='h-9 px-4 text-sm'>
              {isResolving ? 'Preparing player...' : 'Insert media'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

async function resolveBandcampMedia(
  media: ExternalMediaReference
): Promise<ExternalMediaParseResult> {
  const oembedUrl = bandcampOembedUrl(media)
  if (oembedUrl === null) return { ok: true, media }

  try {
    const response = await fetch(oembedUrl)
    if (!response.ok) return bandcampFailure()

    return parseBandcampOembedJson(await response.text())
  } catch {
    return bandcampFailure()
  }
}

function bandcampFailure(): ExternalMediaParseResult {
  return { ok: false, message: 'Bandcamp could not prepare a player for this link.' }
}
