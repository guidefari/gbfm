import { Effect, Stream } from 'effect'
import type { Scope } from 'effect/Scope'
import { AudioEngine, type EngineStatus, type NowPlayingMetadata } from './engine'
import type { QueueTrackType } from './persistedQueue'
import { PlayReporter } from './playReporter'
import { PlayerStorage } from './playerStorage'
import {
  shouldPersistPosition,
  transitionPlaybackIntent,
  transitionSourceCompletion,
  transitionSourcePreparation,
  type PlaybackIntent,
  type SourceCompletion,
  type SourcePreparation,
  type SourcePreparationEvent
} from './playbackState'

export type PlayerCoreCallbacks = {
  readonly onStatus: (status: EngineStatus) => void
  readonly onTrackFinished: () => void
  readonly onError?: (message: string, error: unknown) => void
}

type SourceSession = {
  readonly generation: number
  readonly id: string
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
        Effect.flatMap(() =>
          runDetached('Unable to deliver audio play', playReporter.recordPlay(active.id))
        ),
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
        active.completion = { ...active.completion, started: true }
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
            session = null
            lastPositionPersist = null
            yield* engine.setNowPlaying(null)
            yield* engine.pause
            callbacks.onStatus(yield* engine.currentStatus)
            return
          }

          const active: SourceSession = {
            generation,
            id: track.id,
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
          yield* engine.replace(track.url)
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
