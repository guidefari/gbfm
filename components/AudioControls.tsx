import { useAudioPlayerContext } from 'contexts/AudioPlayer'
import React from 'react'
import { PauseIcon, PlayIcon } from './common/icons'

export const AudioControls = () => {
  const [audioRef, { play, pause }, playAudio] = useAudioPlayerContext()

  if (!audioRef?.src) return

  const buttonStyles = 'z-10 w-14 h-14 p-3 m-5 bg-teal-900 rounded-full text-highlight'

  return (
    <>
      {playAudio ? (
        <button title="Pause Preview Audio" onClick={() => pause()}>
          <PauseIcon />
        </button>
      ) : (
        <button onClick={() => play()}>
          <PlayIcon />
        </button>
      )}
    </>
  )
}
