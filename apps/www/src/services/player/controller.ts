import { shouldPersistPosition, type QueueTrackType } from '@gbfm/player'
import { Effect } from 'effect'
import { RuntimeClient } from '@/runtime'
import { track } from '@/services/analytics'
import { log } from '@/services/logger'
import {
  setActionHandlers,
  setMetadata,
  setPlaybackState,
  setPositionState
} from '@/services/audio-player'
import { recordPlayIfFresh } from './playTracker'
import { clearPosition, loadPosition, savePosition } from './storage'
import type { TransportState, VolumeState } from './atoms'

export type ControllerCallbacks = {
  readonly setTransport: (update: (state: TransportState) => TransportState) => void
  readonly playNext: () => void
  readonly playPrevious: () => void
  readonly getVolume: () => VolumeState
  readonly getCurrentTrack: () => QueueTrackType | null
}

const artistsOf = (track: QueueTrackType) => track.creators?.map((creator) => creator.name) ?? []

export const createPlayerController = (audio: HTMLAudioElement, callbacks: ControllerCallbacks) => {
  let lastPersistedPosition: number | null = null
  let started = false
  let loadedTrackId: string | null = null

  const run = <A, E>(effect: Parameters<typeof RuntimeClient.runPromise<A, E>>[0]) =>
    void RuntimeClient.runPromise(effect).catch((error: unknown) => {
      log('error', 'Player effect failed', { error })
    })

  const persistPosition = (position: number) => {
    const trackId = loadedTrackId
    if (!trackId) return
    if (!shouldPersistPosition(started, lastPersistedPosition, position)) return
    lastPersistedPosition = position
    run(savePosition(trackId, position).pipe(Effect.catch(() => Effect.void)))
  }

  const onTimeUpdate = () => {
    const currentTime = audio.currentTime
    const duration = Number.isFinite(audio.duration) ? audio.duration : 0
    callbacks.setTransport((state) => ({ ...state, currentTime, duration }))
    persistPosition(currentTime)
    if (duration > 0) run(setPositionState(duration, currentTime))
  }

  const onLoadedMetadata = () => {
    const duration = Number.isFinite(audio.duration) ? audio.duration : 0
    callbacks.setTransport((state) => ({ ...state, duration }))
  }

  const onPlay = () => {
    started = true
    callbacks.setTransport((state) => ({ ...state, isPlaying: true }))
    run(setPlaybackState('playing'))
    const current = callbacks.getCurrentTrack()
    if (current) void recordPlayIfFresh(current.id).catch(() => undefined)
  }

  const onPause = () => {
    callbacks.setTransport((state) => ({ ...state, isPlaying: false }))
    run(setPlaybackState('paused'))
    persistPosition(audio.currentTime)
  }

  const onEnded = () => {
    const finished = callbacks.getCurrentTrack()
    started = false
    lastPersistedPosition = null
    callbacks.setTransport((state) => ({ ...state, isPlaying: false, currentTime: 0 }))
    run(
      Effect.gen(function* () {
        yield* setPlaybackState('none')
        if (finished) {
          yield* clearPosition(finished.id).pipe(Effect.catch(() => Effect.void))
          yield* track('audio_completed', {
            trackId: finished.id,
            title: finished.title,
            duration: audio.duration
          })
        }
      })
    )
    callbacks.playNext()
  }

  const onError = () => {
    const current = callbacks.getCurrentTrack()
    run(
      track('audio_error', {
        trackId: current?.id ?? null,
        title: current?.title ?? '',
        errorMessage: audio.error?.message ?? 'unknown'
      })
    )
  }

  const onVisibilityChange = () => {
    if (document.hidden) persistPosition(audio.currentTime)
  }

  audio.addEventListener('timeupdate', onTimeUpdate)
  audio.addEventListener('loadedmetadata', onLoadedMetadata)
  audio.addEventListener('play', onPlay)
  audio.addEventListener('pause', onPause)
  audio.addEventListener('ended', onEnded)
  audio.addEventListener('error', onError)
  document.addEventListener('visibilitychange', onVisibilityChange)

  run(
    setActionHandlers({
      onPlay: () => void audio.play().catch(() => undefined),
      onPause: () => audio.pause(),
      onSeekBackward: (offset) => {
        audio.currentTime = Math.max(0, audio.currentTime - offset)
      },
      onSeekForward: (offset) => {
        audio.currentTime = audio.currentTime + offset
      },
      onPreviousTrack: () => callbacks.playPrevious(),
      onNextTrack: () => callbacks.playNext(),
      onSeekTo: (time) => {
        audio.currentTime = time
      }
    })
  )

  const applyVolume = () => {
    const { volume, isMuted } = callbacks.getVolume()
    audio.volume = isMuted ? 0 : volume / 100
  }

  applyVolume()

  return {
    applyVolume,

    loadTrack: (nextTrack: QueueTrackType, options: { readonly autoplay: boolean }) => {
      if (loadedTrackId === nextTrack.id) {
        if (options.autoplay) void audio.play().catch(() => undefined)
        return
      }

      persistPosition(audio.currentTime)
      loadedTrackId = nextTrack.id
      started = false
      lastPersistedPosition = null
      audio.src = nextTrack.url
      callbacks.setTransport((state) => ({ ...state, currentTime: 0, duration: 0 }))

      run(
        Effect.gen(function* () {
          yield* setMetadata(
            nextTrack.title,
            artistsOf(nextTrack),
            nextTrack.thumbnailUrl ?? undefined
          )

          const saved = yield* loadPosition(nextTrack.id).pipe(
            Effect.catch(() => Effect.succeed(null))
          )

          if (saved && saved.position > 0) {
            audio.currentTime = saved.position
            callbacks.setTransport((state) => ({ ...state, currentTime: saved.position }))
          }

          yield* track('audio_played', {
            trackId: nextTrack.id,
            title: nextTrack.title,
            slug: nextTrack.slug,
            pageUrl: window.location.pathname
          })
        })
      )

      if (options.autoplay) void audio.play().catch(() => undefined)
    },

    play: () => void audio.play().catch(() => undefined),
    pause: () => audio.pause(),
    seekTo: (time: number) => {
      audio.currentTime = time
    },
    seekBy: (delta: number) => {
      audio.currentTime = Math.max(0, audio.currentTime + delta)
    },

    dispose: () => {
      persistPosition(audio.currentTime)
      audio.removeEventListener('timeupdate', onTimeUpdate)
      audio.removeEventListener('loadedmetadata', onLoadedMetadata)
      audio.removeEventListener('play', onPlay)
      audio.removeEventListener('pause', onPause)
      audio.removeEventListener('ended', onEnded)
      audio.removeEventListener('error', onError)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      audio.pause()
    }
  }
}

export type PlayerController = ReturnType<typeof createPlayerController>
