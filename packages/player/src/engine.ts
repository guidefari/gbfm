import * as Context from 'effect/Context'
import * as Data from 'effect/Data'
import type * as Effect from 'effect/Effect'
import type * as Stream from 'effect/Stream'

export type EngineStatus = {
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

/** Playback was refused by the platform, typically because the call did not
 *  originate from a user gesture (Safari's autoplay policy). */
export class PlaybackRejected extends Data.TaggedError('PlaybackRejected')<{
  readonly cause?: unknown
}> {}

export interface AudioEngineShape {
  readonly replace: (url: string) => Effect.Effect<void>
  readonly play: Effect.Effect<void, PlaybackRejected>
  readonly pause: Effect.Effect<void>
  readonly seekTo: (seconds: number) => Effect.Effect<void>
  readonly currentStatus: Effect.Effect<EngineStatus>
  readonly changes: Stream.Stream<EngineStatus>
  readonly setNowPlaying: (metadata: NowPlayingMetadata | null) => Effect.Effect<void>
}

/** The operations the shared player core needs from a platform audio engine.
 *  Implemented over expo-audio on mobile and HTMLAudioElement on web. The
 *  layer is built per mount, since both platforms tie the underlying object to
 *  a React lifecycle. */
export class AudioEngine extends Context.Service<AudioEngine, AudioEngineShape>()(
  '@gbfm/player/AudioEngine'
) {}
