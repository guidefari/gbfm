export const shouldPersistPosition = (
  started: boolean,
  previousPosition: number | null,
  nextPosition: number
) =>
  started &&
  Number.isFinite(nextPosition) &&
  nextPosition >= 0 &&
  (previousPosition === null || Math.abs(nextPosition - previousPosition) >= 1)

export type PlaybackIntent = {
  readonly desiredPlaying: boolean
  readonly pendingPlaying: boolean | null
}

export type PlaybackIntentEvent =
  | { readonly _tag: 'command'; readonly playing: boolean }
  | { readonly _tag: 'status'; readonly playing: boolean }
  | { readonly _tag: 'completed' }

export const transitionPlaybackIntent = (
  state: PlaybackIntent,
  event: PlaybackIntentEvent
): PlaybackIntent => {
  if (event._tag === 'command') {
    return { desiredPlaying: event.playing, pendingPlaying: event.playing }
  }
  if (event._tag === 'completed') {
    return { desiredPlaying: false, pendingPlaying: null }
  }
  if (state.pendingPlaying === null) {
    return { desiredPlaying: event.playing, pendingPlaying: null }
  }
  return event.playing === state.pendingPlaying ? { ...state, pendingPlaying: null } : state
}

export type SourceCompletion = {
  readonly generation: number
  readonly started: boolean
  readonly handled: boolean
  readonly completed: boolean
}

export const transitionSourceCompletion = (
  state: SourceCompletion,
  event: {
    readonly generation: number
    readonly didJustFinish: boolean
    readonly playing: boolean
  }
): { readonly state: SourceCompletion; readonly shouldFinish: boolean } => {
  if (event.generation !== state.generation) return { state, shouldFinish: false }

  const armed =
    state.completed && event.playing && !event.didJustFinish
      ? { ...state, handled: false, completed: false }
      : state
  const shouldFinish = event.didJustFinish && armed.started && !armed.handled
  return {
    state: shouldFinish ? { ...armed, handled: true, completed: true } : armed,
    shouldFinish
  }
}

export type SourcePreparation = {
  readonly generation: number
  readonly sourceLoaded: boolean
  readonly checkpointLoaded: boolean
  readonly duration: number
  readonly preparing: boolean
}

export type SourcePreparationEvent =
  | {
      readonly _tag: 'sourceStatus'
      readonly generation: number
      readonly isLoaded: boolean
      readonly duration: number
    }
  | { readonly _tag: 'checkpointLoaded'; readonly generation: number }

export const transitionSourcePreparation = (
  state: SourcePreparation,
  event: SourcePreparationEvent
): { readonly state: SourcePreparation; readonly shouldPrepare: boolean } => {
  if (event.generation !== state.generation || state.preparing) {
    return { state, shouldPrepare: false }
  }

  // A source counts as loaded only once it reports a usable duration. Safari
  // can report readyState >= 1 with duration still NaN for a cached source,
  // and latching that would prepare the source against duration 0, skip the
  // checkpoint seek, and lock out the durationchange carrying the real value.
  const next =
    event._tag === 'sourceStatus'
      ? {
          ...state,
          sourceLoaded: state.sourceLoaded || (event.isLoaded && event.duration > 0),
          duration: event.duration > 0 ? event.duration : state.duration
        }
      : { ...state, checkpointLoaded: true }
  const shouldPrepare = next.sourceLoaded && next.checkpointLoaded
  return {
    state: shouldPrepare ? { ...next, preparing: true } : next,
    shouldPrepare
  }
}
