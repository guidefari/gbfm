'use client'
import { Pause, Play } from 'lucide-react'
import { useActiveSource, usePlayerActions, useTransport } from '@/services/player'
import { isActivePreview, isActiveQueueTrack } from '@/services/player/activeSource'
import { toQueueTrack, type PlayableAudio } from '@/services/player/toQueueTrack'

type PlayPauseButtonProps =
  | { audio: PlayableAudio; previewUrl?: never }
  | { audio?: never; previewUrl: string }

export const PlayPauseButton = ({ audio, previewUrl }: PlayPauseButtonProps) => {
  const active = useActiveSource()
  const { isPlaying } = useTransport()
  const { playTrack, playPreview, togglePlayPause } = usePlayerActions()

  const isCurrent = audio
    ? isActiveQueueTrack(active, audio.id)
    : isActivePreview(active, previewUrl)

  const handleClick = () => {
    if (!isCurrent) {
      if (audio) playTrack(toQueueTrack(audio))
      else playPreview(previewUrl)
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
