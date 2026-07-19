import { setAudioModeAsync } from 'expo-audio'
import * as Atom from 'effect/unstable/reactivity/Atom'
import { Effect } from 'effect'

const setAudioMode = Effect.tryPromise({
  try: () =>
    setAudioModeAsync({
      playsInSilentMode: true,
      interruptionMode: 'doNotMix',
      allowsRecording: false,
      shouldPlayInBackground: true,
      shouldRouteThroughEarpiece: false
    }),
  catch: (error) => error
})

export const audioModeAtom = Atom.make(setAudioMode)
