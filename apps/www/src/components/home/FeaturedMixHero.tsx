import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { useFeaturedMix } from '@/lib/useFeaturedMix'
import {
  useAudioPlayerActions,
  useAudioPlayerPlaybackState
} from '@/store/audioPlayer'
import { VariantOverlay } from './featuredMix/VariantOverlay'

export function FeaturedMixHero() {
  const { data: featuredMix, isPending } = useFeaturedMix()
  const { loadTrack, play, pause } = useAudioPlayerActions()
  const { audioSrc, isPlaying, currentTrackId } = useAudioPlayerPlaybackState()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)

  const isThisMixLoaded =
    Boolean(audioSrc) && currentTrackId === featuredMix?.id

  const handlePlay = () => {
    if (!featuredMix) return
    setError(null)

    if (isThisMixLoaded) {
      isPlaying ? pause() : play()
      return
    }

    if (!featuredMix.url) {
      setError('No audio available for this mix')
      return
    }

    loadTrack(
      featuredMix.url,
      featuredMix.thumbnailUrl || '',
      featuredMix.title,
      featuredMix.id,
      featuredMix.creators,
      featuredMix.slug
    )
  }

  const showPause = isThisMixLoaded && isPlaying

  return (
    <VariantOverlay
      featuredMix={featuredMix}
      isPending={isPending}
      showPause={showPause}
      isThisMixLoaded={isThisMixLoaded}
      error={error}
      onPlay={handlePlay}
      onBrowse={() => navigate({ to: '/shows' })}
    />
  )
}
