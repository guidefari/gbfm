import { playbackStates } from '@gbfm/ui'
import { describe, expect, it } from 'vitest'
import { toPlaybackState } from './toPlaybackState'

describe('toPlaybackState', () => {
  it('is idle for a track that is not current', () => {
    expect(
      toPlaybackState({ isCurrent: false, isPlaying: true, isBuffering: true, isLoaded: false })
    ).toBe(playbackStates.idle)
  })

  it('is loading while a selected track has not loaded yet', () => {
    expect(
      toPlaybackState({ isCurrent: true, isPlaying: false, isBuffering: false, isLoaded: false })
    ).toBe(playbackStates.loading)
  })

  it('is loading while playback stalls mid track', () => {
    expect(
      toPlaybackState({ isCurrent: true, isPlaying: true, isBuffering: true, isLoaded: true })
    ).toBe(playbackStates.loading)
  })

  it('is playing once audio runs', () => {
    expect(
      toPlaybackState({ isCurrent: true, isPlaying: true, isBuffering: false, isLoaded: true })
    ).toBe(playbackStates.playing)
  })

  it('is idle when paused on a loaded track', () => {
    expect(
      toPlaybackState({ isCurrent: true, isPlaying: false, isBuffering: false, isLoaded: true })
    ).toBe(playbackStates.idle)
  })
})
