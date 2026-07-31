import { playbackStates, type PlaybackState } from '@gbfm/ui'

interface PlaybackStateInput {
  readonly isCurrent: boolean
  readonly isPlaying: boolean
  readonly isBuffering: boolean
  readonly isLoaded: boolean
}

export const toPlaybackState = ({
  isCurrent,
  isPlaying,
  isBuffering,
  isLoaded
}: PlaybackStateInput): PlaybackState => {
  if (!isCurrent) return playbackStates.idle
  if (isPlaying) return isBuffering ? playbackStates.loading : playbackStates.playing
  return isLoaded ? playbackStates.idle : playbackStates.loading
}
