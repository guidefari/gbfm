import React, { createContext, useMemo, useState } from 'react'

// const audio = React.createElement('audio', { src: '' })

const AudioContext = createContext(null)

export const useAudioPlayerContext = () => React.useContext(AudioContext)

export const AudioProvider = ({ children }) => {
  const audioRef = useMemo(() => (typeof window === 'undefined' ? null : new Audio()), [])
  const [playAudio, setPlayAudio] = useState(false)

  //   const play = React.useCallback(
  //     (src) => {
  //       audioRef.src = src
  //       audioRef.play()
  //     },
  //     [audioRef]
  //   )

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
