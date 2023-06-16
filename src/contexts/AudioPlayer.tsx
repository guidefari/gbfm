import { Track } from 'src/lib/types'
import React, { createContext, ReactNode, useEffect, useMemo, useState } from 'react'

const AudioContext = createContext(null)

export const useAudioPlayerContext = (): AudioPlayerContext =>
  React.useContext<AudioPlayerContext | null>(AudioContext)

type AudioPlayerContext = [
  audioRef: HTMLAudioElement,
  handlers: {
    play: () => void
    pause: () => void
    togglePlayPause: () => void
    handleAlbumArtClick: (src: string) => void
    jumpForward: () => void
    jumpBackward: () => void
  },
  playAudio: boolean
]

type Props = {
  children: ReactNode
}

export const AudioProvider = ({ children }: Props) => {
  const audioRef = useMemo(() => (typeof window === 'undefined' ? null : new Audio()), [])
  const [playAudio, setPlayAudio] = useState(false)

  useEffect(() => {
    audioRef.onended = () => {
      handlers.pause()
    }
  }, [audioRef])

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
      togglePlayPause: () => setPlayAudio(!playAudio),
      // TODO: rename to something more generic & fitting of its purpose
      handleAlbumArtClick: (src: string) => {
        if (!src) {
          alert("Yo, there's no preview audio for this one")
        } else if (src === audioRef.src && playAudio === false) {
          handlers.play()
        } else if (src === audioRef.src) {
          handlers.pause()
        } else {
          audioRef.src = src
          handlers.play()
        }
      },
      jumpForward: () => {
        if (!audioRef.src) return
        audioRef.currentTime += 10
      },
      jumpBackward: () => {
        if (!audioRef.src) return
        audioRef.currentTime -= 10
      },
    }),
    [audioRef, playAudio]
  )

  const contextValue = useMemo(
    () => [audioRef, handlers, playAudio],
    [audioRef, handlers, playAudio]
  )

  return <AudioContext.Provider value={contextValue}>{children}</AudioContext.Provider>
}
