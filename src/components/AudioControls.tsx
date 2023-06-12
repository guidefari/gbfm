import { useAudioPlayerContext } from 'src/contexts/AudioPlayer'
import React from 'react'
import { PauseIcon, PlayIcon } from './common/icons'

export const AudioControls = () => {
  const [audioRef, { play, pause }, playAudio] = useAudioPlayerContext()

  if (!audioRef?.src) return

  return (
    <button
      type="button"
      className="inline-flex flex-col items-center justify-center px-5 rounded-full hover:bg-gray-50 dark:hover:bg-gray-800 group"
      title="Pause Preview Audio"
      onClick={() => (playAudio ? pause() : play())}
    >
      {playAudio ? <PauseIcon /> : <PlayIcon />}
    </button>
  )
}
