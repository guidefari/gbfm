import { describe, expect, test } from 'vitest'
import {
  shouldPersistPosition,
  transitionSourcePreparation,
  type SourcePreparation
} from './playbackState'

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
