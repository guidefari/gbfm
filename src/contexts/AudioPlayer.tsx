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
    handleAlbumArtClick: (src: string, thumbnailUrl: string) => void
    jumpForward: () => void
    jumpBackward: () => void
  },
  playAudio: boolean,
  thumbnailUrl: string
]

type Props = {
  children: ReactNode
}

export const AudioProvider = ({ children }: Props) => {
  const audioRef = useMemo(() => (typeof window === 'undefined' ? null : new Audio()), [])
  const [playAudio, setPlayAudio] = useState(false)
  const [thumbnailUrl, setThumbnailUrl] = useState('')

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
      handleAlbumArtClick: (src: string, thumbnailUrl: string) => {
        if (!src) {
          alert("Yo, there's no preview audio for this one")
        } else if (src === audioRef.src && playAudio === false) {
          handlers.play()
        } else if (src === audioRef.src) {
          handlers.pause()
        } else {
          audioRef.src = src
          setThumbnailUrl(thumbnailUrl)
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
    () => [audioRef, handlers, playAudio, thumbnailUrl],
    [audioRef, handlers, playAudio, thumbnailUrl]
  )

  return <AudioContext.Provider value={contextValue}>{children}</AudioContext.Provider>
}
