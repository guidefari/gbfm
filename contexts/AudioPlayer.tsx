import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'

// const audio = React.createElement('audio', { src: '' })

const AudioContext = createContext(null)

export const useAudioPlayerContext = () => React.useContext(AudioContext)

// export const useAudio = () => {
//     const audio = useContext(AudioContext)
//   console.log('audio:', audio)

//   return audio
// }

// - if the src is the same, pause audio
// - need the play pause state of the audio
// - on, off, & toggle handler

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
      play: (src: string) => {
        audioRef.src = src
        setPlayAudio(true)
        audioRef.play()
      },
      pause: () => {
        setPlayAudio(true)
        audioRef.pause()
        // setTheme('dark')
      },
      toggle: () => {
        // setTheme(s => (s === 'light' ? 'dark' : 'light'))
      },
    }),
    [audioRef]
  )

  return (
    <AudioContext.Provider value={[audioRef, handlers, playAudio]}>
      {children}
    </AudioContext.Provider>
  )
}
