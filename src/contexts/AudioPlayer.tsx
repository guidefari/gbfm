import React, { createContext, ReactNode, useEffect, useMemo, useState } from 'react'
import { DEFAULT_IMAGE_URL, LATEST_MIX } from '../constants'

const AudioContext = createContext(null)

export const useAudioPlayerContext = (): AudioPlayerContext =>
  React.useContext<AudioPlayerContext | null>(AudioContext)

export const AudioProvider = ({ children }: Props) => {
  const audioRef: HTMLAudioElement | null = useMemo(
    () => (typeof window === 'undefined' ? null : new Audio(LATEST_MIX.mp3Url)),
    []
  )
  const [playAudio, setPlayAudio] = useState(false)
  const [thumbnailUrl, setThumbnailUrl] = useState(LATEST_MIX.thumbnailUrl ?? DEFAULT_IMAGE_URL)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    audioRef.onended = () => {
      handlers.pause()
    }
    audioRef.ontimeupdate = handleTimeUpdate
  }, [audioRef])

  const handleTimeUpdate = () => {
    const progress = (audioRef.currentTime / audioRef.duration) * 100 || 0
    setProgress(progress)
  }

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
          if (thumbnailUrl) {
            setThumbnailUrl(thumbnailUrl)
          }
          handlers.play()
        }
      },
      jumpForward: () => {
        if (!audioRef.src) return
        audioRef.currentTime += 30
      },
      jumpBackward: () => {
        if (!audioRef.src) return
        audioRef.currentTime -= 15
      },
      setTimeUsingPercentage: (percentage: number) => {
        audioRef.currentTime = (percentage / 100) * audioRef.duration
      },
    }),
    [audioRef, playAudio]
  )

  const contextValue = useMemo(
    () => [audioRef, handlers, playAudio, thumbnailUrl, progress],
    [audioRef, handlers, playAudio, thumbnailUrl, progress]
  )

  return <AudioContext.Provider value={contextValue}>{children}</AudioContext.Provider>
}

type AudioPlayerContext = [
  audioRef: HTMLAudioElement,
  handlers: {
    play: () => void
    pause: () => void
    togglePlayPause: () => void
    handleAlbumArtClick: (src: string, thumbnailUrl: string) => void
    jumpForward: () => void
    jumpBackward: () => void
    setTimeUsingPercentage: (percentage: number) => void
  },
  playAudio: boolean,
  thumbnailUrl: string,
  progress: number
]

type Props = {
  children: ReactNode
}
