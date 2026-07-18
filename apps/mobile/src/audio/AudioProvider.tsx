import { setAudioModeAsync } from 'expo-audio'
import { type PropsWithChildren, useEffect } from 'react'

export function AudioProvider({ children }: PropsWithChildren) {
  useEffect(() => {
    void setAudioModeAsync({
      playsInSilentMode: true,
      interruptionMode: 'doNotMix',
      allowsRecording: false,
      shouldPlayInBackground: true,
      shouldRouteThroughEarpiece: false
    })
  }, [])

  return children
}
