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
  parseBandcampOembedJson,
  parseExternalMediaUrl,
  type ExternalMediaParseResult,
  type ExternalMediaReference
} from './external-media'

/** Props for a dialog that inserts an external media MDX component into editorial content. */
export type ExternalMediaPickerDialogProps = {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly onInsert: (markdown: string) => void
}

/** Lets editorial authors paste a supported media URL without writing iframe HTML. */
export function ExternalMediaPickerDialog({
  open,
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
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>Embed external media</DialogTitle>
          <DialogDescription>
            Paste a Spotify, SoundCloud, Bandcamp, or YouTube link. GBFM creates the player for you.
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
            <Button type='button' variant='outline' onClick={close}>
              Cancel
            </Button>
            <Button type='submit' disabled={isResolving}>
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
