import { expect, it } from 'vitest'

import { authHref } from './links'

it('carries only the params that have a value', () => {
  expect(authHref('/auth/sign-up', { returnTo: '/privacy' })).toBe(
    '/auth/sign-up?returnTo=%2Fprivacy',
  )
  expect(authHref('/auth/sign-up', { returnTo: '' })).toBe('/auth/sign-up')
})
