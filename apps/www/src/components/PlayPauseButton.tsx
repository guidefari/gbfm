'use client'
import { PlayToggle } from '@gbfm/ui'
import { useNowPlayingTrack, usePlayerActions, useTransport } from '@/services/player'
import { toPlaybackState } from '@/services/player/toPlaybackState'
import { toQueueTrack, type PlayableAudio } from '@/services/player/toQueueTrack'

export const PlayPauseButton = ({ audio }: { audio: PlayableAudio }) => {
  const current = useNowPlayingTrack()
  const { isPlaying, isBuffering, isLoaded } = useTransport()
  const { playTrack, togglePlayPause } = usePlayerActions()

  const isCurrent = current?.id === audio.id

  const handleToggle = () => {
    if (!isCurrent) {
      playTrack(toQueueTrack(audio))
      return
    }
    togglePlayPause()
  }

  return (
    <PlayToggle
      state={toPlaybackState({ isCurrent, isPlaying, isBuffering, isLoaded })}
      variant='icon'
      label={audio.title}
      onToggle={handleToggle}
      className={isCurrent && isPlaying ? 'py-[2px] text-green-300 default-icon' : 'default-icon'}
    />
  )
}
