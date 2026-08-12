import * as Context from 'effect/Context'
import * as Data from 'effect/Data'
import type * as Effect from 'effect/Effect'
import type * as Stream from 'effect/Stream'

export type EngineStatus = {
  /** Identifies the source installed by replace. Statuses already queued for a
   * previous source retain its generation and can be discarded by the core. */
  readonly sourceGeneration: number | null
  readonly isLoaded: boolean
  readonly playing: boolean
  readonly didJustFinish: boolean
  readonly currentTime: number
  readonly duration: number
  readonly isBuffering: boolean
}

export type NowPlayingMetadata = {
  readonly title: string
  readonly artist?: string
  readonly artworkUrl?: string
}

export type PlaybackCommandHandlers = {
  readonly onPlay: () => void
  readonly onPause: () => void
  readonly onSeekBackward: (offset: number) => void
  readonly onSeekForward: (offset: number) => void
  readonly onPreviousTrack: () => void
  readonly onNextTrack: () => void
  readonly onSeekTo: (time: number) => void
}

/** Playback was refused by the platform, typically because the call did not
 *  originate from a user gesture (Safari's autoplay policy). */
export class PlaybackRejected extends Data.TaggedError('PlaybackRejected')<{
  readonly cause?: unknown
}> {}

export interface AudioEngineContract {
  readonly replace: (url: string, sourceGeneration: number) => Effect.Effect<void>
  readonly clearSource: Effect.Effect<void>
  readonly play: Effect.Effect<void, PlaybackRejected>
  readonly pause: Effect.Effect<void>
  readonly seekTo: (seconds: number) => Effect.Effect<void>
  readonly setVolume: (volume: number) => Effect.Effect<void>
  readonly setMuted: (muted: boolean) => Effect.Effect<void>
  readonly currentStatus: Effect.Effect<EngineStatus>
  readonly changes: Stream.Stream<EngineStatus>
  readonly setNowPlaying: (metadata: NowPlayingMetadata | null) => Effect.Effect<void>
  readonly setPositionState: (duration: number, position: number) => Effect.Effect<void>
  readonly setCommandHandlers: (handlers: PlaybackCommandHandlers | null) => Effect.Effect<void>
}

/** The operations the shared player core needs from a platform audio engine.
 *  Implemented over expo-audio on mobile and HTMLAudioElement on web. The
 *  layer is built per mount, since both platforms tie the underlying object to
 *  a React lifecycle. */
export class AudioEngine extends Context.Service<AudioEngine, AudioEngineContract>()(
  '@gbfm/player/AudioEngine'
) {}
