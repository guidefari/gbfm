import * as Effect from 'effect/Effect'
import { Heart, ListPlus, Play } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/use-toast'
import {
  addToQueueEffect,
  checkSavedTrackEffect,
  playTrackEffect,
  saveTrackEffect,
  spotifyErrorMessage,
  type SpotifyRequestError,
  spotifyIdFromUrl,
  spotifyUriFromUrl
} from '@/lib/spotify-pkce'
import { runAppEffect } from '@/runtime'

interface Props {
  spotifyUrl: string
}

const withSpotifyErrorToast = (title: string) =>
  Effect.catch((e: SpotifyRequestError) =>
    Effect.sync(() =>
      toast({
        title,
        description: spotifyErrorMessage(e),
        variant: 'destructive'
      })
    )
  )

export function TrackPlaybackControls({ spotifyUrl }: Props) {
  const uri = spotifyUriFromUrl(spotifyUrl)
  const trackId = spotifyIdFromUrl(spotifyUrl)

  const [saved, setSaved] = useState<boolean | null>(null)
  const [savePending, setSavePending] = useState(false)
  const [playPending, setPlayPending] = useState(false)
  const [queuePending, setQueuePending] = useState(false)

  useEffect(() => {
    if (!trackId) return
    runAppEffect(checkSavedTrackEffect(trackId))
      .then(setSaved)
      .catch(() => setSaved(null))
  }, [trackId])

  if (!uri || !trackId) return null

  const handlePlay = async () => {
    setPlayPending(true)
    await runAppEffect(
      playTrackEffect(uri).pipe(withSpotifyErrorToast('Playback failed'))
    ).finally(() => setPlayPending(false))
  }

  const handleQueue = async () => {
    setQueuePending(true)
    await runAppEffect(
      addToQueueEffect(uri).pipe(
        Effect.map(() => toast({ title: 'Added to queue' })),
        withSpotifyErrorToast('Queue failed')
      )
    ).finally(() => setQueuePending(false))
  }

  const handleSave = async () => {
    setSavePending(true)
    await runAppEffect(
      saveTrackEffect(trackId).pipe(
        Effect.map(() => {
          setSaved(true)
          toast({ title: 'Saved to library' })
        }),
        withSpotifyErrorToast('Save failed')
      )
    ).finally(() => setSavePending(false))
  }

  return (
    <div className='flex items-center gap-0.5'>
      <Button
        type='button'
        variant='ghost'
        size='icon'
        className='w-7 h-7 text-muted-foreground hover:text-foreground'
        onClick={handlePlay}
        disabled={playPending}
        aria-label='Play track'>
        <Play className='w-3.5 h-3.5' />
      </Button>
      <Button
        type='button'
        variant='ghost'
        size='icon'
        className='w-7 h-7 text-muted-foreground hover:text-foreground'
        onClick={handleQueue}
        disabled={queuePending}
        aria-label='Add to queue'>
        <ListPlus className='w-3.5 h-3.5' />
      </Button>
      <Button
        type='button'
        variant='ghost'
        size='icon'
        className='w-7 h-7'
        onClick={handleSave}
        disabled={savePending || saved === true}
        aria-label={saved ? 'Saved to library' : 'Save to library'}
        style={{ color: saved ? '#1DB954' : undefined }}>
        <Heart className={`w-3.5 h-3.5 ${saved ? 'fill-current' : ''}`} />
      </Button>
    </div>
  )
}
