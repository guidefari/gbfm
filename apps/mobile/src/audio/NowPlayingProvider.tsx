import type { AudioResponse } from '@gbfm/api/audio'
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio'
import { useAtomValue } from '@effect/atom-react'
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useMemo,
  useState
} from 'react'
import { audioModeAtom } from '@/store/atoms/audio-mode'

type Track = typeof AudioResponse.Type

type NowPlayingContextValue = {
  readonly track: Track | null
  readonly isPlaying: boolean
  readonly isLoaded: boolean
  readonly isBuffering: boolean
  readonly currentTime: number
  readonly duration: number
  readonly loadAndPlay: (track: Track) => void
  readonly togglePlayback: () => void
}

const NowPlayingContext = createContext<NowPlayingContextValue | null>(null)

export function NowPlayingProvider({ children }: PropsWithChildren) {
  useAtomValue(audioModeAtom)

  const [track, setTrack] = useState<Track | null>(null)
  const player = useAudioPlayer(null, { updateInterval: 500 })
  const status = useAudioPlayerStatus(player)

  const loadAndPlay = useCallback(
    (nextTrack: Track) => {
      if (track?.id !== nextTrack.id) {
        setTrack(nextTrack)
        player.replace(nextTrack.url)
      }
      player.play()
    },
    [player, track?.id]
  )

  const togglePlayback = useCallback(() => {
    if (status.playing) player.pause()
    else player.play()
  }, [player, status.playing])

  const value = useMemo(
    () => ({
      track,
      isPlaying: status.playing,
      isLoaded: status.isLoaded,
      isBuffering: status.isBuffering,
      currentTime: status.currentTime,
      duration: status.duration,
      loadAndPlay,
      togglePlayback
    }),
    [track, status, loadAndPlay, togglePlayback]
  )

  return <NowPlayingContext value={value}>{children}</NowPlayingContext>
}

export function useNowPlaying() {
  const context = useContext(NowPlayingContext)
  if (!context) throw new Error('useNowPlaying must be used within a NowPlayingProvider')
  return context
}
