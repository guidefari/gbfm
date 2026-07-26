import { Effect, Stream } from 'effect'
import type { Scope } from 'effect/Scope'
import { AudioEngine, type EngineStatus, type NowPlayingMetadata } from './engine'
import type { QueueTrackType } from './persistedQueue'
import { PlayReporter } from './playReporter'
import { PlayerStorage } from './playerStorage'

const shouldPersistPosition = (
  started: boolean,
  previousPosition: number | null,
  nextPosition: number
) =>
  started &&
  Number.isFinite(nextPosition) &&
  nextPosition >= 0 &&
  (previousPosition === null || Math.abs(nextPosition - previousPosition) >= 1)

type PlaybackIntent = {
  readonly desiredPlaying: boolean
  readonly pendingPlaying: boolean | null
}

type PlaybackIntentEvent =
  | { readonly _tag: 'command'; readonly playing: boolean }
  | { readonly _tag: 'status'; readonly playing: boolean }
  | { readonly _tag: 'completed' }

const transitionPlaybackIntent = (
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

type SourceCompletion = {
  readonly generation: number
  readonly started: boolean
  readonly handled: boolean
  readonly completed: boolean
}

const transitionSourceCompletion = (
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

type SourcePreparation = {
  readonly generation: number
  readonly sourceLoaded: boolean
  readonly checkpointLoaded: boolean
  readonly duration: number
  readonly preparing: boolean
}

type SourcePreparationEvent =
  | {
      readonly _tag: 'sourceStatus'
      readonly generation: number
      readonly isLoaded: boolean
      readonly duration: number
    }
  | { readonly _tag: 'checkpointLoaded'; readonly generation: number }

const transitionSourcePreparation = (
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

export type PlayerCoreCallbacks = {
  readonly onStatus: (status: EngineStatus) => void
  readonly onTrackStarted?: (track: QueueTrackType) => void
  readonly onTrackFinished: () => void
  readonly onError?: (message: string, error: unknown) => void
}

type SourceSession = {
  readonly generation: number
  readonly id: string
  readonly track: QueueTrackType
  intent: PlaybackIntent
  preparation: SourcePreparation
  completion: SourceCompletion
  checkpoint: number | null
  started: boolean
}

const buildMetadata = (track: QueueTrackType): NowPlayingMetadata => {
  const artist = track.creators?.map((creator) => creator.name).join(', ') ?? ''
  return {
    title: track.title,
    artist: artist.length > 0 ? artist : undefined,
    artworkUrl: track.thumbnailUrl ?? undefined
  }
}

export interface PlayerCoreShape {
  readonly setSource: (track: QueueTrackType | null) => Effect.Effect<void>
  readonly play: (trackId: string) => Effect.Effect<void>
  readonly pause: Effect.Effect<void>
  readonly isDesiredPlaying: Effect.Effect<boolean>
  readonly seekTo: (seconds: number) => Effect.Effect<void>
  readonly requestPlayOnReady: (trackId: string) => Effect.Effect<void>
  readonly detachCurrentSource: Effect.Effect<void>
  readonly currentTrackId: Effect.Effect<string | null>
}

/** Engine-agnostic playback session: source generations, checkpoint restore,
 *  play/pause intent reconciliation, position persistence, and end-of-track
 *  handling. Platform differences live behind the AudioEngine service.
 *
 *  Built inside a scope: the status subscription is forked as a fiber and is
 *  interrupted when the enclosing scope closes. */
export const makePlayerCore = (
  callbacks: PlayerCoreCallbacks
): Effect.Effect<PlayerCoreShape, never, AudioEngine | PlayerStorage | PlayReporter | Scope> =>
  Effect.gen(function* () {
    const engine = yield* AudioEngine
    const storage = yield* PlayerStorage
    const playReporter = yield* PlayReporter

    const onError =
      callbacks.onError ?? ((message: string, error: unknown) => console.error(message, error))

    let generationCounter = 0
    let session: SourceSession | null = null
    let playOnReady: string | null = null
    let lastPositionPersist: { readonly id: string; readonly at: number } | null = null

    const runDetached = (label: string, effect: Effect.Effect<void, unknown>) =>
      effect.pipe(
        Effect.catchCause((cause) => Effect.sync(() => onError(label, cause))),
        Effect.forkDetach,
        Effect.asVoid
      )

    /** Starts playback and reconciles intent when the platform refuses, so a
     *  rejected play does not leave the core believing it is playing. */
    const attemptPlay = (active: SourceSession) =>
      engine.play.pipe(
        Effect.tap(() => {
          active.intent = transitionPlaybackIntent(active.intent, {
            _tag: 'command',
            playing: true
          })
          active.completion = { ...active.completion, started: true }
          callbacks.onTrackStarted?.(active.track)
          return runDetached('Unable to deliver audio play', playReporter.recordPlay(active.id))
        }),
        Effect.catchTag('PlaybackRejected', (error) =>
          Effect.sync(() => {
            if (session === active) {
              active.intent = transitionPlaybackIntent(active.intent, {
                _tag: 'command',
                playing: false
              })
            }
            onError('Playback was refused by the platform', error)
          })
        )
      )

    const startSource = (active: SourceSession) =>
      Effect.gen(function* () {
        active.started = true
        lastPositionPersist =
          active.checkpoint === null ? null : { id: active.id, at: active.checkpoint }
        if (!active.intent.desiredPlaying) return
        active.intent = transitionPlaybackIntent(active.intent, { _tag: 'command', playing: true })
        yield* attemptPlay(active)
      })

    const finishPreparing = (active: SourceSession) =>
      Effect.gen(function* () {
        if (session !== active || !active.preparation.preparing || active.started) return

        const checkpoint = active.checkpoint
        const shouldSeek =
          checkpoint !== null &&
          checkpoint > 1 &&
          active.preparation.duration > 0 &&
          checkpoint < active.preparation.duration - 5

        if (!shouldSeek) {
          yield* startSource(active)
          return
        }

        yield* engine
          .seekTo(checkpoint)
          .pipe(
            Effect.catchCause((cause) =>
              Effect.sync(() => onError('Unable to restore audio position', cause))
            )
          )
        if (session !== active) return
        yield* startSource(active)
      })

    const advancePreparation = (active: SourceSession, event: SourcePreparationEvent) =>
      Effect.suspend(() => {
        const transition = transitionSourcePreparation(active.preparation, event)
        active.preparation = transition.state
        return transition.shouldPrepare ? finishPreparing(active) : Effect.void
      })

    const observeStatus = (status: EngineStatus) =>
      Effect.gen(function* () {
        const active = session
        if (active && status.sourceGeneration !== active.generation) return
        if (!active && status.sourceGeneration !== null) return

        callbacks.onStatus(status)
        if (!active) return

        yield* advancePreparation(active, {
          _tag: 'sourceStatus',
          generation: active.generation,
          isLoaded: status.isLoaded,
          duration: status.duration
        })
        if (!status.isLoaded) return

        const completion = transitionSourceCompletion(active.completion, {
          generation: active.generation,
          didJustFinish: status.didJustFinish,
          playing: status.playing
        })
        active.completion = completion.state
        if (completion.shouldFinish) {
          active.intent = transitionPlaybackIntent(active.intent, { _tag: 'completed' })
          yield* runDetached(
            'Unable to clear completed audio position',
            storage.clearPosition(active.id)
          )
          callbacks.onTrackFinished()
          return
        }

        if (active.started) {
          active.intent = transitionPlaybackIntent(active.intent, {
            _tag: 'status',
            playing: status.playing
          })
        }

        const previousPosition =
          lastPositionPersist?.id === active.id ? lastPositionPersist.at : null
        if (!shouldPersistPosition(active.started, previousPosition, status.currentTime)) return
        lastPositionPersist = { id: active.id, at: status.currentTime }
        yield* runDetached(
          'Unable to persist audio position',
          storage.savePosition(active.id, status.currentTime)
        )
      })

    yield* engine.changes.pipe(
      Stream.runForEach(observeStatus),
      Effect.catchCause((cause) => Effect.sync(() => onError('Audio status stream failed', cause))),
      Effect.forkScoped
    )

    return {
      setSource: (track: QueueTrackType | null) =>
        Effect.gen(function* () {
          const generation = ++generationCounter

          if (!track) {
            yield* engine.pause
            session = null
            lastPositionPersist = null
            yield* engine.clearSource
            yield* engine.setNowPlaying(null)
            callbacks.onStatus(yield* engine.currentStatus)
            return
          }

          const active: SourceSession = {
            generation,
            id: track.id,
            track,
            intent: { desiredPlaying: playOnReady === track.id, pendingPlaying: null },
            preparation: {
              generation,
              sourceLoaded: false,
              checkpointLoaded: false,
              duration: 0,
              preparing: false
            },
            completion: { generation, started: false, handled: false, completed: false },
            checkpoint: null,
            started: false
          }
          playOnReady = null
          session = active
          lastPositionPersist = null

          // Pausing first stops engines that auto-resume on source replacement
          // from playing the new track before its checkpoint is restored.
          yield* engine.pause
          yield* engine.replace(track.url, generation)
          yield* engine.setNowPlaying(buildMetadata(track))
          yield* observeStatus(yield* engine.currentStatus)

          const saved = yield* storage.loadPosition(track.id).pipe(
            Effect.catchCause((cause) =>
              Effect.sync(() => {
                onError('Unable to load audio position', cause)
                return null
              })
            )
          )
          if (session !== active) return
          active.checkpoint = saved?.position ?? null
          yield* advancePreparation(active, { _tag: 'checkpointLoaded', generation })
          // The source may have finished loading while the checkpoint read was
          // in flight; re-reading status covers events the stream missed.
          yield* observeStatus(yield* engine.currentStatus)
        }),

      play: (trackId: string) =>
        Effect.gen(function* () {
          const active = session
          if (!active || active.id !== trackId) return
          active.intent = transitionPlaybackIntent(active.intent, {
            _tag: 'command',
            playing: true
          })
          if (!active.started) return

          if (active.completion.completed) {
            yield* engine
              .seekTo(0)
              .pipe(
                Effect.catchCause((cause) =>
                  Effect.sync(() => onError('Unable to restart completed audio', cause))
                )
              )
          }
          if (session !== active || !active.intent.desiredPlaying) return
          yield* attemptPlay(active)
        }),

      pause: Effect.gen(function* () {
        const active = session
        if (!active) return
        playOnReady = null
        active.intent = transitionPlaybackIntent(active.intent, {
          _tag: 'command',
          playing: false
        })
        yield* engine.pause
      }),

      isDesiredPlaying: Effect.sync(
        () => playOnReady !== null || session?.intent.desiredPlaying === true
      ),

      seekTo: (seconds: number) =>
        Effect.gen(function* () {
          const active = session
          yield* engine.seekTo(seconds)
          if (session !== active || !active?.started) return
          lastPositionPersist = { id: active.id, at: seconds }
          yield* runDetached(
            'Unable to persist audio position',
            storage.savePosition(active.id, seconds)
          )
        }).pipe(
          Effect.catchCause((cause) => Effect.sync(() => onError('Unable to seek audio', cause)))
        ),

      /** Mark the next source change as user-initiated so it plays once ready. */
      requestPlayOnReady: (trackId: string) =>
        Effect.sync(() => {
          playOnReady = trackId
        }),

      /** Stop the current source from firing end-of-track advance when it is
       *  being replaced or removed deliberately. */
      detachCurrentSource: Effect.sync(() => {
        if (session) {
          session.completion = { ...session.completion, handled: true, completed: false }
        }
      }),

      currentTrackId: Effect.sync(() => session?.id ?? null)
    }
  })
