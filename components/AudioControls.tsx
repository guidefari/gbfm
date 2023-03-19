import { useAudioPlayerContext } from 'contexts/AudioPlayer'
import React from 'react'
import { PauseIcon, PlayIcon } from './common/icons'

export const AudioControls = () => {
  const [audioRef, { play, pause }, playAudio] = useAudioPlayerContext()

  if (!audioRef?.src) return

  return (
    <button
      type="button"
      className="nav-button"
      title="Pause Preview Audio"
      onClick={() => (playAudio ? pause() : play())}
    >
      {playAudio ? <PauseIcon /> : <PlayIcon />}
    </button>
  )
}
