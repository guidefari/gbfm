import { useAudioPlayerContext } from 'contexts/AudioPlayer'
import React from 'react'
import { PauseIcon, PlayIcon } from './common/icons'

export const AudioControls = () => {
  const [audioRef, { play, pause }, playAudio] = useAudioPlayerContext()

  if (!audioRef?.src) return

  return (
    <>
      {playAudio ? (
        <button
          title="Pause Preview Audio"
          className="z-10 p-3 m-5 bg-teal-900 rounded-full text-highlight"
          onClick={() => pause()}
        >
          <PauseIcon />
        </button>
      ) : (
        <button
          className="z-10 p-3 m-5 bg-teal-900 rounded-full text-highlight"
          onClick={() => play()}
        >
          <PlayIcon />
        </button>
      )}
    </>
  )
}
