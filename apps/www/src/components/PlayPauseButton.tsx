'use client'
import { Pause, Play } from 'lucide-react'
import { useNowPlayingTrack, usePlayerActions, useTransport } from '@/services/player'
import { usePreviewSrc } from '@/services/player/atoms'
import { toQueueTrack, type PlayableAudio } from '@/services/player/toQueueTrack'

type PlayPauseButtonProps =
  | { audio: PlayableAudio; previewUrl?: never }
  | { audio?: never; previewUrl: string }

export const PlayPauseButton = ({ audio, previewUrl }: PlayPauseButtonProps) => {
  const current = useNowPlayingTrack()
  const previewSrc = usePreviewSrc()
  const { isPlaying } = useTransport()
  const { playTrack, playPreview, togglePlayPause, pause, play } = usePlayerActions()

  const isCurrent = audio ? current?.id === audio.id : previewSrc === previewUrl

  const handleClick = () => {
    if (!isCurrent) {
      if (audio) playTrack(toQueueTrack(audio))
      else playPreview(previewUrl)
      return
    }

    if (audio) {
      togglePlayPause()
      return
    }

    // Previews sit outside the queue, so the core has no session to toggle.
    if (isPlaying) pause()
    else play()
  }

  const Icon = isCurrent && isPlaying ? Pause : Play

  return (
    <Icon
      className={isCurrent && isPlaying ? 'py-[2px] text-green-300 default-icon' : 'default-icon'}
      onClick={handleClick}
    />
  )
}
