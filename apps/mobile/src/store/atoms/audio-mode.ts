import { setAudioModeAsync } from 'expo-audio'
import * as Atom from 'effect/unstable/reactivity/Atom'
import { Data, Effect } from 'effect'

class AudioModeUnavailable extends Data.TaggedError('AudioModeUnavailable')<{
  readonly cause: unknown
}> {}

const setAudioMode = Effect.tryPromise({
  try: () =>
    setAudioModeAsync({
      playsInSilentMode: true,
      interruptionMode: 'doNotMix',
      allowsRecording: false,
      shouldPlayInBackground: true,
      shouldRouteThroughEarpiece: false
    }),
  catch: (cause) => new AudioModeUnavailable({ cause })
})

export const audioModeAtom = Atom.make(setAudioMode)
