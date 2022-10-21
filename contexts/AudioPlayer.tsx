import React, { createContext, useContext, useEffect, useRef } from 'react'

// const audio = React.createElement('audio', { src: '' })

const AudioContext = createContext(null)
const audioRef = typeof window === 'undefined' ? null : new Audio()

export const useAudio = () => {
  const audio = useContext(AudioContext)
  console.log('audio:', audio)

  return audio
}

export const AudioProvider = ({ children }) => {
  return <AudioContext.Provider value={audioRef}>{children}</AudioContext.Provider>
}
