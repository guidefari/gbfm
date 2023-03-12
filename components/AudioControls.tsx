import { useAudioPlayerContext } from 'contexts/AudioPlayer'
import React from 'react'
import { PauseIcon, PlayIcon } from './common/icons'

export const AudioControls = () => {
  const [audioRef, { play, pause }, playAudio] = useAudioPlayerContext()

  if (!audioRef?.src) return

  return (
    <>
      {playAudio ? (
        <button className='nav-button' title="Pause Preview Audio" onClick={() => pause()}>
          <PauseIcon />
        </button>
      ) : (
        <button className='nav-button' onClick={() => play()}>
          <PlayIcon />
        </button>
      )}
    </>
  )
}
