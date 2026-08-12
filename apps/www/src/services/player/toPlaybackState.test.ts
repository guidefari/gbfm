import { playbackStates } from '@gbfm/ui'
import { describe, expect, it } from 'vitest'
import { toPlaybackState } from './toPlaybackState'

describe('toPlaybackState', () => {
  it('maps inactive, loading, buffering, playing, and paused tracks to control states', () => {
    const cases = [
      [
        { isCurrent: false, isPlaying: true, isBuffering: true, isLoaded: false },
        playbackStates.idle
      ],
      [
        { isCurrent: true, isPlaying: false, isBuffering: false, isLoaded: false },
        playbackStates.loading
      ],
      [
        { isCurrent: true, isPlaying: true, isBuffering: true, isLoaded: true },
        playbackStates.loading
      ],
      [
        { isCurrent: true, isPlaying: true, isBuffering: false, isLoaded: true },
        playbackStates.playing
      ],
      [
        { isCurrent: true, isPlaying: false, isBuffering: false, isLoaded: true },
        playbackStates.idle
      ]
    ] as const

    for (const [input, expected] of cases) {
      expect(toPlaybackState(input)).toBe(expected)
    }
  })
})
