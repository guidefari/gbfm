import { describe, expect, it } from 'vitest'

import { preferencesKey, readPlayerPreferences } from './preferences'

describe('player preference storage', () => {
  it('reads the existing settings key and retains independently disabled preferences', () => {
    const preferences = readPlayerPreferences(() => ({
      getItem: (key) =>
        key === preferencesKey ? '{"continueQueue":false,"restorePosition":true}' : null,
    }))

    expect(preferences).toEqual({ continueQueue: false, restorePosition: true })
  })

  it.each([null, '{', '{"continueQueue":"false","restorePosition":false}', '{}'])(
    'defaults invalid or absent stored preferences: %s',
    (stored) => {
      expect(readPlayerPreferences(() => ({ getItem: () => stored }))).toEqual({
        continueQueue: true,
        restorePosition: true,
      })
    },
  )

  it('defaults when browser policy denies access to storage', () => {
    expect(
      readPlayerPreferences(() => {
        throw new Error('Storage denied')
      }),
    ).toEqual({
      continueQueue: true,
      restorePosition: true,
    })
  })
})
