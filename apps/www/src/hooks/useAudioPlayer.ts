import { useEffect, useMemo } from 'react'
import { useAudioPlayerStore } from '@/store/audioPlayer'

/**
 * Hook to initialize and manage the HTML audio element
 * Should be used once at the app level (e.g., in AppShell or main layout)
 */
export const useAudioPlayerInitializer = () => {
  const setAudioRef = useAudioPlayerStore((state) => state.setAudioRef)

  const audioRef = useMemo(() => {
    if (typeof window === 'undefined') return null
    return new Audio()
  }, [])

  useEffect(() => {
    if (audioRef) {
      setAudioRef(audioRef)

      return () => {
        setAudioRef(null)
      }
    }
  }, [audioRef, setAudioRef])

  return audioRef
}
