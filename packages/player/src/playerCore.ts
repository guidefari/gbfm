import { Effect } from 'effect'
import type { AudioEngine, EngineStatus, NowPlayingMetadata } from './engine'
import type { QueueTrackType } from './persistedQueue'
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

/** Storage operations the core needs, already provided with their runtime.
 *  Apps build this from the PlayerStorage service via `providePlayerStorage`. */
export type PlayerCoreStorage = {
  readonly loadPosition: (
    trackId: string
  ) => Effect.Effect<{ readonly position: number } | null, unknown, never>
  readonly savePosition: (trackId: string, position: number) => Effect.Effect<void, unknown, never>
  readonly clearPosition: (trackId: string) => Effect.Effect<void, unknown, never>
}

export type PlayerCoreCallbacks = {
  readonly onStatus: (status: EngineStatus) => void
  readonly onTrackFinished: () => void
  readonly recordPlay: (trackId: string) => Effect.Effect<void, unknown, never>
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

/** Engine-agnostic playback session: source generations, checkpoint restore,
 *  play/pause intent reconciliation, position persistence, and end-of-track
 *  handling. Platform differences live behind the AudioEngine port. */
export const createPlayerCore = (
  engine: AudioEngine,
  storage: PlayerCoreStorage,
  callbacks: PlayerCoreCallbacks
) => {
  const onError =
    callbacks.onError ?? ((message: string, error: unknown) => console.error(message, error))

  let generationCounter = 0
  let session: SourceSession | null = null
  let playOnReady: string | null = null
  let lastPositionPersist: { readonly id: string; readonly at: number } | null = null
  let subscription: { readonly remove: () => void } | null = null

  const run = (label: string, effect: Effect.Effect<void, unknown, never>) => {
    Effect.runPromise(effect).catch((error: unknown) => onError(label, error))
  }

  const finishPreparing = (active: SourceSession) => {
    if (session !== active || !active.preparation.preparing || active.started) return

    const start = () => {
      active.started = true
      active.completion = { ...active.completion, started: true }
      lastPositionPersist =
        active.checkpoint === null ? null : { id: active.id, at: active.checkpoint }
      if (!active.intent.desiredPlaying) return
      active.intent = transitionPlaybackIntent(active.intent, { _tag: 'command', playing: true })
      engine.play()
      run('Unable to deliver audio play', callbacks.recordPlay(active.id))
    }

    const checkpoint = active.checkpoint
    const shouldSeek =
      checkpoint !== null &&
      checkpoint > 1 &&
      active.preparation.duration > 0 &&
      checkpoint < active.preparation.duration - 5

    if (!shouldSeek) {
      start()
      return
    }

    engine.seekTo(checkpoint).then(
      () => {
        if (session !== active) return
        start()
      },
      (error: unknown) => {
        if (session === active) start()
        onError('Unable to restore audio position', error)
      }
    )
  }

  const advancePreparation = (active: SourceSession, event: SourcePreparationEvent) => {
    const transition = transitionSourcePreparation(active.preparation, event)
    active.preparation = transition.state
    if (transition.shouldPrepare) finishPreparing(active)
  }

  const observeStatus = (active: SourceSession) => (status: EngineStatus) => {
    if (session !== active) return
    callbacks.onStatus(status)
    advancePreparation(active, {
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
      run('Unable to clear completed audio position', storage.clearPosition(active.id))
      callbacks.onTrackFinished()
      return
    }

    if (active.started) {
      active.intent = transitionPlaybackIntent(active.intent, {
        _tag: 'status',
        playing: status.playing
      })
    }

    const previousPosition = lastPositionPersist?.id === active.id ? lastPositionPersist.at : null
    if (!shouldPersistPosition(active.started, previousPosition, status.currentTime)) return
    lastPositionPersist = { id: active.id, at: status.currentTime }
    run('Unable to persist audio position', storage.savePosition(active.id, status.currentTime))
  }

  return {
    /** Point the engine at a track (or nothing). Call when the queue's current
     *  track changes; safe to call repeatedly for the same track. */
    setSource: (track: QueueTrackType | null) => {
      subscription?.remove()
      subscription = null
      const generation = ++generationCounter

      if (!track) {
        session = null
        engine.setNowPlaying?.(null)
        engine.pause()
        callbacks.onStatus(engine.currentStatus())
        lastPositionPersist = null
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

      // Pausing first stops engines that auto-resume on source replacement from
      // playing the new track before its checkpoint has been restored.
      engine.pause()
      engine.replace(track.url)
      engine.setNowPlaying?.(buildMetadata(track))

      const listener = observeStatus(active)
      subscription = engine.subscribe(listener)
      listener(engine.currentStatus())

      Effect.runPromise(storage.loadPosition(track.id)).then(
        (saved) => {
          if (session !== active) return
          active.checkpoint = saved?.position ?? null
          advancePreparation(active, { _tag: 'checkpointLoaded', generation })
        },
        (error: unknown) => {
          if (session !== active) return
          advancePreparation(active, { _tag: 'checkpointLoaded', generation })
          onError('Unable to load audio position', error)
        }
      )
    },

    /** Resume or restart the loaded track. */
    play: (trackId: string) => {
      const active = session
      if (!active || active.id !== trackId) return
      active.intent = transitionPlaybackIntent(active.intent, { _tag: 'command', playing: true })
      if (!active.started) return

      const start = () => {
        if (session !== active || !active.intent.desiredPlaying) return
        engine.play()
        run('Unable to deliver audio play', callbacks.recordPlay(trackId))
      }

      if (active.completion.completed) {
        engine
          .seekTo(0)
          .then(start, (error: unknown) => onError('Unable to restart completed audio', error))
        return
      }
      start()
    },

    pause: () => {
      const active = session
      if (!active) return
      playOnReady = null
      active.intent = transitionPlaybackIntent(active.intent, { _tag: 'command', playing: false })
      engine.pause()
    },

    isDesiredPlaying: () => playOnReady !== null || session?.intent.desiredPlaying === true,

    seekTo: (seconds: number) => {
      const active = session
      engine.seekTo(seconds).then(
        () => {
          if (session !== active || !active?.started) return
          lastPositionPersist = { id: active.id, at: seconds }
          run('Unable to persist audio position', storage.savePosition(active.id, seconds))
        },
        (error: unknown) => onError('Unable to seek audio', error)
      )
    },

    /** Mark the next source change as user-initiated so it plays once ready. */
    requestPlayOnReady: (trackId: string) => {
      playOnReady = trackId
    },

    /** Stop the current source from firing end-of-track advance when it is
     *  being replaced or removed deliberately. */
    detachCurrentSource: () => {
      if (session) {
        session.completion = { ...session.completion, handled: true, completed: false }
      }
    },

    currentTrackId: () => session?.id ?? null,

    dispose: () => {
      subscription?.remove()
      subscription = null
      session = null
    }
  }
}

export type PlayerCore = ReturnType<typeof createPlayerCore>
