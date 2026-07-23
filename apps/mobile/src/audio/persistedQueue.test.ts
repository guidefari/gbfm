import { Effect } from 'effect'
import { describe, expect, test } from 'vitest'
import { parsePersistedQueue } from './persistedQueue'

const storedTrack = {
  id: 'one',
  title: 'One',
  slug: 'one',
  url: 'https://example.com/one.mp3',
  thumbnailUrl: null,
  type: 'mix'
}

describe('persisted audio queue parsing', () => {
  test('accepts a cross-field-consistent queue', async () => {
    const queue = await Effect.runPromise(
      parsePersistedQueue({ tracks: [storedTrack], currentIndex: 0 })
    )
    expect(queue.currentIndex).toBe(0)
  })

  test.each([
    { tracks: [], currentIndex: 0 },
    { tracks: [storedTrack], currentIndex: 1 },
    { tracks: [storedTrack], currentIndex: 0.5 },
    { tracks: [storedTrack, storedTrack], currentIndex: 0 }
  ])('rejects contradictory stored state %#', async (value) => {
    const exit = await Effect.runPromiseExit(parsePersistedQueue(value))
    expect(exit._tag).toBe('Failure')
  })
})
