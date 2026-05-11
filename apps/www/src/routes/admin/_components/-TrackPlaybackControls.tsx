import { Heart, ListPlus, Play } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/use-toast'
import {
  addToQueueEffect,
  checkSavedTrackEffect,
  playTrackEffect,
  saveTrackEffect,
  spotifyIdFromUrl,
  spotifyUriFromUrl
} from '@/lib/spotify-pkce'
import { runAppEffect } from '@/runtime'

interface Props {
  spotifyUrl: string
}

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
    try {
      await runAppEffect(playTrackEffect(uri))
    } catch {
      toast({
        title: 'Playback failed',
        description: 'No active Spotify device?',
        variant: 'destructive'
      })
    } finally {
      setPlayPending(false)
    }
  }

  const handleQueue = async () => {
    setQueuePending(true)
    try {
      await runAppEffect(addToQueueEffect(uri))
      toast({ title: 'Added to queue' })
    } catch {
      toast({
        title: 'Queue failed',
        description: 'No active Spotify device?',
        variant: 'destructive'
      })
    } finally {
      setQueuePending(false)
    }
  }

  const handleSave = async () => {
    setSavePending(true)
    try {
      await runAppEffect(saveTrackEffect(trackId))
      setSaved(true)
      toast({ title: 'Saved to library' })
    } catch {
      toast({ title: 'Save failed', variant: 'destructive' })
    } finally {
      setSavePending(false)
    }
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
