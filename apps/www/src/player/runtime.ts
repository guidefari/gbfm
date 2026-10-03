import {
  AudioEngine,
  createWebAudioStorageAdapter,
  layerFromAdapter,
  makeAudioPlayback,
  makePlayReporterLayer,
  PlaybackRejected,
  type AudioPlaybackReporter,
  type AudioPlaybackController,
  type EngineStatus,
  type NowPlayingMetadata,
  type PlaybackCommandHandlers,
} from '@gbfm/player'
import { Context, Data, Effect, Layer, ManagedRuntime, Queue, Stream } from 'effect'

import { reportPlayerTelemetry } from '../telemetry/browser'
import { readPlayerPreferences } from './preferences'

export type AudioPort = {
  src: string
  currentTime: number
  readonly duration: number
  readonly paused: boolean
  readonly ended: boolean
  readonly readyState: number
  volume: number
  muted: boolean
  load(): void
  play(): Promise<void>
  pause(): void
  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ): void
  removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | EventListenerOptions,
  ): void
}

const status = (audio: AudioPort, finished: boolean, generation: number | null): EngineStatus => ({
  sourceGeneration: generation,
  isLoaded: audio.readyState >= 1,
  playing: !audio.paused && !audio.ended,
  didJustFinish: finished,
  currentTime: Number.isFinite(audio.currentTime) ? audio.currentTime : 0,
  duration: Number.isFinite(audio.duration) ? audio.duration : 0,
  isBuffering: audio.readyState < 3 && !audio.paused,
})

const hasMediaSession = () => 'navigator' in globalThis && 'mediaSession' in navigator

export const makeHtmlAudioEngineLayer = (audio: AudioPort) =>
  Layer.effect(
    AudioEngine,
    Effect.gen(function* () {
      let finished = false
      let generation: number | null = null

      const changes = Stream.callback<EngineStatus>((queue) =>
        Effect.gen(function* () {
          const emit = () => Queue.offerUnsafe(queue, status(audio, finished, generation))

          const ended = () => {
            finished = true
            emit()
            finished = false
          }

          const events = [
            'timeupdate',
            'loadedmetadata',
            'durationchange',
            'canplay',
            'waiting',
            'play',
            'pause',
          ]

          for (const event of events) audio.addEventListener(event, emit)
          audio.addEventListener('ended', ended)
          yield* Effect.addFinalizer(() =>
            Effect.sync(() => {
              for (const event of events) audio.removeEventListener(event, emit)
              audio.removeEventListener('ended', ended)
            }),
          )
        }),
      )

      const setHandlers = (handlers: PlaybackCommandHandlers | null) =>
        Effect.sync(() => {
          if (!hasMediaSession()) return

          const actions: ReadonlyArray<MediaSessionAction> = [
            'play',
            'pause',
            'seekbackward',
            'seekforward',
            'previoustrack',
            'nexttrack',
            'seekto',
          ]

          const entries: ReadonlyArray<
            readonly [MediaSessionAction, MediaSessionActionHandler | null]
          > = handlers
            ? [
                ['play', handlers.onPlay],
                ['pause', handlers.onPause],
                ['seekbackward', (details) => handlers.onSeekBackward(details.seekOffset ?? 15)],
                ['seekforward', (details) => handlers.onSeekForward(details.seekOffset ?? 30)],
                ['previoustrack', handlers.onPreviousTrack],
                ['nexttrack', handlers.onNextTrack],
                [
                  'seekto',
                  (details) =>
                    details.seekTime !== undefined && handlers.onSeekTo(details.seekTime),
                ],
              ]
            : actions.map((action): readonly [MediaSessionAction, null] => [action, null])

          for (const [action, handler] of entries) {
            try {
              navigator.mediaSession.setActionHandler(action, handler)
            } catch {
              /* unsupported action */
            }
          }
        })

      return {
        replace: (url: string, nextGeneration: number) =>
          Effect.sync(() => {
            generation = nextGeneration
            finished = false
            audio.src = url
            audio.load()
          }),
        clearSource: Effect.sync(() => {
          generation = null
          finished = false
          audio.src = ''
          audio.load()
        }),
        play: Effect.tryPromise({
          try: () => audio.play(),
          catch: (cause) => new PlaybackRejected({ cause }),
        }),
        pause: Effect.sync(() => audio.pause()),
        seekTo: (seconds: number) =>
          Effect.sync(() => {
            audio.currentTime = Math.max(0, seconds)
          }),
        setVolume: (volume: number) =>
          Effect.sync(() => {
            audio.volume = Math.max(0, Math.min(1, volume))
          }),
        setMuted: (muted: boolean) =>
          Effect.sync(() => {
            audio.muted = muted
          }),
        currentStatus: Effect.sync(() => status(audio, finished, generation)),
        changes,
        setNowPlaying: (metadata: NowPlayingMetadata | null) =>
          Effect.sync(() => {
            if (!hasMediaSession()) return
            navigator.mediaSession.metadata =
              metadata === null
                ? null
                : new MediaMetadata({
                    title: metadata.title,
                    artist: metadata.artist,
                    artwork: metadata.artworkUrl ? [{ src: metadata.artworkUrl }] : [],
                  })
          }),
        setPositionState: (duration: number, position: number) =>
          Effect.sync(() => {
            if (!hasMediaSession() || duration <= 0 || !Number.isFinite(duration)) return

            try {
              navigator.mediaSession.setPositionState({
                duration,
                position: Math.min(Math.max(0, position), duration),
                playbackRate: 1,
              })
            } catch {
              /* invalid transient position */
            }
          }),
        setCommandHandlers: setHandlers,
      }
    }),
  )

export type PlayerClientValue = { readonly controller: AudioPlaybackController }

export class PlayerClient extends Context.Service<PlayerClient, PlayerClientValue>()(
  '@gbfm/www/PlayerClient',
) {}

class PlayDeliveryFailed extends Data.TaggedError('PlayDeliveryFailed')<{
  readonly reason: 'unavailable' | 'rejected'
}> {}

export type BrowserDependencies = {
  readonly createAudio: () => AudioPort
  readonly storage: () => Storage | undefined
  readonly deliverPlay: (trackId: string) => Effect.Effect<void, PlayDeliveryFailed>
  readonly reporter: AudioPlaybackReporter
}

export const makePlayerClientLayer = (dependencies: BrowserDependencies) =>
  Layer.effect(
    PlayerClient,
    Effect.acquireRelease(
      Effect.promise(async () => {
        const audio = dependencies.createAudio()
        const storage = layerFromAdapter(createWebAudioStorageAdapter(dependencies.storage))

        const services = Layer.mergeAll(
          makeHtmlAudioEngineLayer(audio),
          storage,
          makePlayReporterLayer(dependencies.deliverPlay).pipe(Layer.provide(storage)),
        )

        const runtime = ManagedRuntime.make(services)
        let resolveController: (controller: AudioPlaybackController) => void = () => undefined

        const controllerPromise = new Promise<AudioPlaybackController>((resolve) => {
          resolveController = resolve
        })

        runtime.runFork(
          Effect.scoped(
            makeAudioPlayback(runtime, dependencies.reporter, () =>
              readPlayerPreferences(dependencies.storage),
            ).pipe(
              Effect.tap((controller) => Effect.sync(() => resolveController(controller))),
              Effect.andThen(Effect.never),
            ),
          ),
        )

        return { audio, runtime, controller: await controllerPromise }
      }),
      ({ audio, runtime }) =>
        Effect.promise(async () => {
          audio.pause()
          await runtime.dispose()
        }),
    ).pipe(Effect.map(({ controller }) => ({ controller }))),
  )

/** Whole-application browser resource. It is lazy: no browser global is read at module evaluation. */
export const playerClientLayer = makePlayerClientLayer({
  createAudio: () => new Audio(),
  storage: () => ('window' in globalThis ? window.localStorage : undefined),
  deliverPlay: (trackId) =>
    Effect.tryPromise({
      try: (signal) =>
        fetch(`/api/content/audio/${encodeURIComponent(trackId)}/play`, {
          method: 'POST',
          credentials: 'same-origin',
          signal,
        }),
      catch: () => new PlayDeliveryFailed({ reason: 'unavailable' }),
    }).pipe(
      Effect.flatMap((response) =>
        response.ok ? Effect.void : Effect.fail(new PlayDeliveryFailed({ reason: 'rejected' })),
      ),
    ),
  reporter: {
    onTrackPlayed: () => Effect.sync(() => reportPlayerTelemetry('play')),
    onTrackPaused: () => Effect.sync(() => reportPlayerTelemetry('pause')),
    onError: () => Effect.sync(() => reportPlayerTelemetry('error')),
  },
})
