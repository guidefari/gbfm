import { describe, expect, test } from 'vitest'
import {
  shouldPersistPosition,
  transitionPlaybackIntent,
  transitionSourceCompletion,
  transitionSourcePreparation,
  type SourceCompletion,
  type SourcePreparation
} from './playbackState'

describe('playback intent', () => {
  test('rapid commands use synchronous desired state despite delayed status', () => {
    const playing = transitionPlaybackIntent(
      { desiredPlaying: false, pendingPlaying: null },
      { _tag: 'command', playing: true }
    )
    const paused = transitionPlaybackIntent(playing, { _tag: 'command', playing: false })
    const stalePlaying = transitionPlaybackIntent(paused, { _tag: 'status', playing: true })

    expect(stalePlaying).toEqual({ desiredPlaying: false, pendingPlaying: false })
    expect(transitionPlaybackIntent(stalePlaying, { _tag: 'status', playing: false })).toEqual({
      desiredPlaying: false,
      pendingPlaying: null
    })
  })

  test('completion clears autoplay intent', () => {
    expect(
      transitionPlaybackIntent(
        { desiredPlaying: true, pendingPlaying: null },
        { _tag: 'completed' }
      )
    ).toEqual({ desiredPlaying: false, pendingPlaying: null })
  })
})

const coldSource = (generation = 1): SourcePreparation => ({
  generation,
  sourceLoaded: false,
  checkpointLoaded: false,
  duration: 0,
  preparing: false
})

describe('audio position persistence', () => {
  test('does not overwrite a checkpoint while a source is cold-loading', () => {
    expect(shouldPersistPosition(false, null, 0)).toBe(false)
  })

  test('persists a backward seek instead of waiting to catch up', () => {
    expect(shouldPersistPosition(true, 120, 30)).toBe(true)
  })

  test('suppresses sub-second status noise', () => {
    expect(shouldPersistPosition(true, 30, 30.5)).toBe(false)
  })
})

describe('audio source preparation', () => {
  test('keeps a cold source waiting', () => {
    const result = transitionSourcePreparation(coldSource(), {
      _tag: 'sourceStatus',
      generation: 1,
      isLoaded: false,
      duration: 0
    })

    expect(result.shouldPrepare).toBe(false)
    expect(result.state.sourceLoaded).toBe(false)
  })

  test('accepts an already-loaded cached source once its checkpoint is loaded', () => {
    const cached = transitionSourcePreparation(coldSource(), {
      _tag: 'sourceStatus',
      generation: 1,
      isLoaded: true,
      duration: 180
    })
    const restored = transitionSourcePreparation(cached.state, {
      _tag: 'checkpointLoaded',
      generation: 1
    })

    expect(restored.shouldPrepare).toBe(true)
    expect(restored.state).toMatchObject({ duration: 180, preparing: true })
  })

  test('waits for a real duration when a cached source loads without one', () => {
    const metadataless = transitionSourcePreparation(coldSource(), {
      _tag: 'sourceStatus',
      generation: 1,
      isLoaded: true,
      duration: 0
    })
    const restored = transitionSourcePreparation(metadataless.state, {
      _tag: 'checkpointLoaded',
      generation: 1
    })

    expect(metadataless.state.sourceLoaded).toBe(false)
    expect(restored.shouldPrepare).toBe(false)

    const measured = transitionSourcePreparation(restored.state, {
      _tag: 'sourceStatus',
      generation: 1,
      isLoaded: true,
      duration: 180
    })

    expect(measured.shouldPrepare).toBe(true)
    expect(measured.state).toMatchObject({ duration: 180, preparing: true })
  })

  test('rejects work owned by a stale generation', () => {
    const state = coldSource(2)
    const result = transitionSourcePreparation(state, {
      _tag: 'checkpointLoaded',
      generation: 1
    })

    expect(result).toEqual({ state, shouldPrepare: false })
  })

  test('prepares when source loading completes after checkpoint restore', () => {
    const restored = transitionSourcePreparation(coldSource(), {
      _tag: 'checkpointLoaded',
      generation: 1
    })
    const loaded = transitionSourcePreparation(restored.state, {
      _tag: 'sourceStatus',
      generation: 1,
      isLoaded: true,
      duration: 240
    })

    expect(loaded.shouldPrepare).toBe(true)
    expect(loaded.state).toMatchObject({ checkpointLoaded: true, duration: 240 })
  })
})

describe('audio source completion', () => {
  const active: SourceCompletion = {
    generation: 2,
    started: true,
    handled: false,
    completed: false
  }

  test('consumes completion exactly once for the active source', () => {
    const completed = transitionSourceCompletion(active, {
      generation: 2,
      didJustFinish: true,
      playing: false
    })
    const duplicate = transitionSourceCompletion(completed.state, {
      generation: 2,
      didJustFinish: true,
      playing: false
    })

    expect(completed.shouldFinish).toBe(true)
    expect(duplicate.shouldFinish).toBe(false)
  })

  test('rejects completion delivered by a stale prior source', () => {
    expect(
      transitionSourceCompletion(active, {
        generation: 1,
        didJustFinish: true,
        playing: false
      }).shouldFinish
    ).toBe(false)
  })

  test('ignores completion before the active source has started', () => {
    expect(
      transitionSourceCompletion(
        { generation: 2, started: false, handled: false, completed: false },
        { generation: 2, didJustFinish: true, playing: false }
      ).shouldFinish
    ).toBe(false)
  })

  test('re-arms completion after the same source actively replays', () => {
    const replaying = transitionSourceCompletion(
      { ...active, handled: true, completed: true },
      { generation: 2, didJustFinish: false, playing: true }
    )
    const completedAgain = transitionSourceCompletion(replaying.state, {
      generation: 2,
      didJustFinish: true,
      playing: false
    })

    expect(replaying.state.handled).toBe(false)
    expect(completedAgain.shouldFinish).toBe(true)
  })

  test('does not re-arm a prior source invalidated during replacement', () => {
    const invalidated = transitionSourceCompletion(
      { ...active, handled: true, completed: false },
      { generation: 2, didJustFinish: false, playing: true }
    )

    expect(invalidated.state.handled).toBe(true)
  })
})
