import { useEffect } from 'react'
import { DEFAULT_IMAGE_URL } from '@/lib/constants'
import { useAudioByType } from '@/lib/http'
import { useAudioPlayerActions, useAudioPlayerState } from '@/store/audioPlayer'

export function useDefaultTrackPreloader() {
  const { audioSrc, isInitialized } = useAudioPlayerState()
  const { preloadTrack } = useAudioPlayerActions()
  const { data: mixes } = useAudioByType('mix')

  useEffect(() => {
    if (!isInitialized) return
    if (audioSrc) return
    if (!mixes || mixes.length === 0) return

    const latestMix = mixes[0]
    preloadTrack(
      latestMix.url,
      latestMix.thumbnailUrl || DEFAULT_IMAGE_URL,
      latestMix.title,
      latestMix.id
    )
  }, [isInitialized, audioSrc, mixes, preloadTrack])
}
