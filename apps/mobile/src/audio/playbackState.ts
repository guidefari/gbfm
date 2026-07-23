export const shouldPersistPosition = (
  started: boolean,
  previousPosition: number | null,
  nextPosition: number
) =>
  started &&
  Number.isFinite(nextPosition) &&
  nextPosition >= 0 &&
  (previousPosition === null || Math.abs(nextPosition - previousPosition) >= 1)

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

  const next =
    event._tag === 'sourceStatus'
      ? {
          ...state,
          sourceLoaded: state.sourceLoaded || event.isLoaded,
          duration: event.isLoaded ? event.duration : state.duration
        }
      : { ...state, checkpointLoaded: true }
  const shouldPrepare = next.sourceLoaded && next.checkpointLoaded
  return {
    state: shouldPrepare ? { ...next, preparing: true } : next,
    shouldPrepare
  }
}
