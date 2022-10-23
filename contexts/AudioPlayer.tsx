import React, { createContext, useMemo, useState } from 'react'

const AudioContext = createContext(null)

export const useAudioPlayerContext = (): AudioPlayerContext => React.useContext(AudioContext)

type AudioPlayerContext = [
  audioRef: HTMLAudioElement,
  handlers: {
    play: () => void
    pause: () => void
    handleAlbumArtClick: (src: string) => void
  },
  playAudio: boolean
]

export const AudioProvider = ({ children }) => {
  const audioRef = useMemo(() => (typeof window === 'undefined' ? null : new Audio()), [])
  const [playAudio, setPlayAudio] = useState(false)

  const handlers = React.useMemo(
    () => ({
      play: () => {
        setPlayAudio(true)
        audioRef.play()
      },
      pause: () => {
        setPlayAudio(false)
        audioRef.pause()
      },
      handleAlbumArtClick: (src: string) => {
        if (!src) {
          alert("Yo, there's no preview audio for this one")
          return
        } else if (src === audioRef.src && playAudio === false) {
          handlers.play()
        } else if (src === audioRef.src) {
          handlers.pause()
        } else {
          audioRef.src = src
          handlers.play()
        }
      },
    }),
    [audioRef, playAudio]
  )

  return (
    <AudioContext.Provider value={[audioRef, handlers, playAudio]}>
      {children}
    </AudioContext.Provider>
  )
}
