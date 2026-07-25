import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { useFeaturedMix } from '@/lib/useFeaturedMix'
import { useNowPlayingTrack, usePlayerActions, useTransport } from '@/services/player'
import { toQueueTrack } from '@/services/player/toQueueTrack'
import { VariantOverlay } from './featuredMix/VariantOverlay'

export function FeaturedMixHero() {
  const { data: featuredMix, isPending } = useFeaturedMix()
  const { playTrack, togglePlayPause } = usePlayerActions()
  const currentTrack = useNowPlayingTrack()
  const { isPlaying } = useTransport()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)

  const isThisMixLoaded = currentTrack?.id === featuredMix?.id

  const handlePlay = () => {
    if (!featuredMix) return
    setError(null)

    if (isThisMixLoaded) {
      togglePlayPause()
      return
    }

    if (!featuredMix.url) {
      setError('No audio available for this mix')
      return
    }

    playTrack(toQueueTrack(featuredMix))
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
