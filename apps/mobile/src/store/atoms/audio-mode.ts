import { Data, Effect } from 'effect'
import * as Atom from 'effect/unstable/reactivity/Atom'
import { setAudioModeAsync } from 'expo-audio'

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
      shouldRouteThroughEarpiece: false,
    }),
  catch: (cause) => new AudioModeUnavailable({ cause }),
})

export const audioModeAtom = Atom.make(setAudioMode)
