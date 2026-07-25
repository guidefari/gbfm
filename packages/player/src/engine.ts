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

/** The operations the shared player core needs from a platform audio engine.
 *  Implemented over expo-audio on mobile and HTMLAudioElement on web. */
export type AudioEngine = {
  readonly replace: (url: string) => void
  readonly play: () => void
  readonly pause: () => void
  readonly seekTo: (seconds: number) => Promise<void>
  readonly currentStatus: () => EngineStatus
  readonly subscribe: (listener: (status: EngineStatus) => void) => { readonly remove: () => void }
  readonly setNowPlaying?: (metadata: NowPlayingMetadata | null) => void
}
