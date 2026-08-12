import { describe, expect, test } from 'vitest'
import { persistFullscreenVisibility, readStoredFullscreenVisibility } from './visibilityStorage'

const makeStorage = (initialValue: string | null = null) => {
  let value = initialValue

  return {
    storage: {
      getItem: () => value,
      setItem: (_key: string, next: string) => {
        value = next
      }
    },
    value: () => value
  }
}

describe('fullscreen visibility storage', () => {
  test('restores and persists the fullscreen player state', () => {
    expect(readStoredFullscreenVisibility(makeStorage('true').storage)).toBe(true)
    expect(readStoredFullscreenVisibility(makeStorage('false').storage)).toBe(false)
    expect(readStoredFullscreenVisibility(makeStorage().storage)).toBe(false)
    expect(readStoredFullscreenVisibility(makeStorage('yes').storage)).toBe(false)

    const stored = makeStorage()
    persistFullscreenVisibility(true, stored.storage)
    expect(stored.value()).toBe('true')
    persistFullscreenVisibility(false, stored.storage)
    expect(stored.value()).toBe('false')
  })

  test('keeps the player usable when browser storage is unavailable', () => {
    const unavailable = {
      getItem: () => {
        throw new Error('unavailable')
      },
      setItem: () => {
        throw new Error('unavailable')
      }
    }

    expect(readStoredFullscreenVisibility(unavailable)).toBe(false)
    expect(() => persistFullscreenVisibility(true, unavailable)).not.toThrow()
  })
})
