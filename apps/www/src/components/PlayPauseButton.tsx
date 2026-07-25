'use client'
import { Pause, Play } from 'lucide-react'
import { useState } from 'react'
import { useNowPlayingTrack, usePlayerActions, useTransport } from '@/services/player'
import { toQueueTrack, type PlayableAudio } from '@/services/player/toQueueTrack'

type PlayPauseButtonProps =
  | { audio: PlayableAudio; previewUrl?: never }
  | { audio?: never; previewUrl: string }

export const PlayPauseButton = ({ audio, previewUrl }: PlayPauseButtonProps) => {
  const current = useNowPlayingTrack()
  const { isPlaying } = useTransport()
  const { playTrack, playPreview, togglePlayPause, currentSrc } = usePlayerActions()
  const [startedPreview, setStartedPreview] = useState(false)

  const isCurrent = audio ? current?.id === audio.id : startedPreview && currentSrc() === previewUrl

  const handleClick = () => {
    if (isCurrent) {
      togglePlayPause()
      return
    }

    if (audio) {
      playTrack(toQueueTrack(audio))
      return
    }

    playPreview(previewUrl)
    setStartedPreview(true)
  }

  const Icon = isCurrent && isPlaying ? Pause : Play

  return (
    <Icon
      className={isCurrent && isPlaying ? 'py-[2px] text-green-300 default-icon' : 'default-icon'}
      onClick={handleClick}
    />
  )
}
