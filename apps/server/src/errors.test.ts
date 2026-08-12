import { expect, test } from 'vitest'
import { getErrorMessage } from './errors'

test('returns safe user-facing messages without leaking database queries or request parameters', () => {
  const databaseError = new Error(
    'Failed query: select * from "user" where "email" = $1\nparams: private@example.com',
    { cause: { code: '23505', detail: 'private-token' } }
  )

  const databaseMessage = getErrorMessage(databaseError)
  expect(databaseMessage).toBe('Database query failed (23505)')
  expect(databaseMessage).not.toContain('private')
  expect(databaseMessage).not.toContain('select')

  expect(getErrorMessage(new Error('Request failed\nparams: private-token'))).toBe('Request failed')
  expect(
    getErrorMessage(new Error('Failed query: select private_data', { cause: { code: 'invalid' } }))
  ).toBe('Database query failed')

  for (const cause of [undefined, null, { code: 23505 }]) {
    expect(
      getErrorMessage(new Error('Failed query: select private_data', { cause }))
    ).toBe('Database query failed')
  }
})
