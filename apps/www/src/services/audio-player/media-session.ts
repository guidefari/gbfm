import * as Context from 'effect/Context'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'

export interface MediaSessionHandlers {
  onPlay: () => void
  onPause: () => void
  onSeekBackward: (offset: number) => void
  onSeekForward: (offset: number) => void
  onPreviousTrack: () => void
  onNextTrack: () => void
  onSeekTo: (time: number) => void
}

export interface MediaSessionServiceShape {
  setMetadata: (title: string, artists: string[], artwork?: string) => Effect.Effect<void>
  setPlaybackState: (state: 'playing' | 'paused' | 'none') => Effect.Effect<void>
  setPositionState: (duration: number, position: number) => Effect.Effect<void>
  setActionHandlers: (handlers: MediaSessionHandlers) => Effect.Effect<void>
}

const hasMediaSession = () => typeof navigator !== 'undefined' && 'mediaSession' in navigator

export class MediaSessionService extends Context.Service<
  MediaSessionService,
  MediaSessionServiceShape
>()('@gbfm/www/MediaSessionService') {}

export const MediaSessionServiceLive = Layer.sync(MediaSessionService, () => ({
  setMetadata: (title: string, artists: string[], artwork?: string) =>
    Effect.sync(() => {
      if (!hasMediaSession()) return
      navigator.mediaSession.metadata = new MediaMetadata({
        title,
        artist: artists.join(', '),
        artwork: artwork ? [{ src: artwork }] : []
      })
    }),

  setPlaybackState: (state: 'playing' | 'paused' | 'none') =>
    Effect.sync(() => {
      if (!hasMediaSession()) return
      navigator.mediaSession.playbackState = state
    }),

  setPositionState: (duration: number, position: number) =>
    Effect.sync(() => {
      if (!hasMediaSession() || !duration || !Number.isFinite(duration)) return
      try {
        navigator.mediaSession.setPositionState({
          duration,
          playbackRate: 1,
          position: Math.min(position, duration)
        })
      } catch {}
    }),

  setActionHandlers: (handlers: MediaSessionHandlers) =>
    Effect.sync(() => {
      if (!hasMediaSession()) return
      navigator.mediaSession.setActionHandler('play', handlers.onPlay)
      navigator.mediaSession.setActionHandler('pause', handlers.onPause)
      navigator.mediaSession.setActionHandler('seekbackward', (d) =>
        handlers.onSeekBackward(d.seekOffset ?? 15)
      )
      navigator.mediaSession.setActionHandler('seekforward', (d) =>
        handlers.onSeekForward(d.seekOffset ?? 30)
      )
      navigator.mediaSession.setActionHandler('previoustrack', handlers.onPreviousTrack)
      navigator.mediaSession.setActionHandler('nexttrack', handlers.onNextTrack)
      navigator.mediaSession.setActionHandler('seekto', (d) => {
        if (d.seekTime != null) handlers.onSeekTo(d.seekTime)
      })
    })
}))

export const setMetadata = (title: string, artists: string[], artwork?: string) =>
  Effect.andThen(MediaSessionService, (s) => s.setMetadata(title, artists, artwork))

export const setPlaybackState = (state: 'playing' | 'paused' | 'none') =>
  Effect.andThen(MediaSessionService, (s) => s.setPlaybackState(state))

export const setPositionState = (duration: number, position: number) =>
  Effect.andThen(MediaSessionService, (s) => s.setPositionState(duration, position))

export const setActionHandlers = (handlers: MediaSessionHandlers) =>
  Effect.andThen(MediaSessionService, (s) => s.setActionHandlers(handlers))

export const MediaSessionServiceTest = Layer.succeed(MediaSessionService, {
  setMetadata: (_title: string, _artists: string[], _artwork?: string) => Effect.void,
  setPlaybackState: (_state: 'playing' | 'paused' | 'none') => Effect.void,
  setPositionState: (_duration: number, _position: number) => Effect.void,
  setActionHandlers: (_handlers: MediaSessionHandlers) => Effect.void
})
