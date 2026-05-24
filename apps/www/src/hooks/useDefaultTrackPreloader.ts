import { useEffect } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { DEFAULT_IMAGE_URL } from '@/lib/constants'
import { useAudioByType } from '@/lib/http'
import { useAudioPlayerActions, useAudioPlayerStore } from '@/store/audioPlayer'

export function useDefaultTrackPreloader() {
  const { audioSrc, isInitialized } = useAudioPlayerStore(
    useShallow((state) => ({
      audioSrc: state.audioSrc,
      isInitialized: state.isInitialized
    }))
  )
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
      latestMix.id,
      latestMix.creators,
      latestMix.slug
    )
  }, [isInitialized, audioSrc, mixes, preloadTrack])
}
