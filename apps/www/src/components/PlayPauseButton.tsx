'use client'
import { Pause, Play } from 'lucide-react'
import { useNowPlayingTrack, usePlayerActions, useTransport } from '@/services/player'
import { toQueueTrack, type PlayableAudio } from '@/services/player/toQueueTrack'

export const PlayPauseButton = ({ audio }: { audio: PlayableAudio }) => {
  const current = useNowPlayingTrack()
  const { isPlaying } = useTransport()
  const { playTrack, togglePlayPause } = usePlayerActions()

  const isCurrent = current?.id === audio.id

  const handleClick = () => {
    if (!isCurrent) {
      playTrack(toQueueTrack(audio))
      return
    }
    togglePlayPause()
  }

  const Icon = isCurrent && isPlaying ? Pause : Play

  return (
    <Icon
      className={isCurrent && isPlaying ? 'py-[2px] text-green-300 default-icon' : 'default-icon'}
      onClick={handleClick}
    />
  )
}
