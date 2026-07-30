import { describe, expect, test } from 'vitest'
import { getErrorMessage } from './errors'

describe('getErrorMessage', () => {
  test('replaces Drizzle query text and parameters with a Postgres error code', () => {
    const cause = Object.assign(new Error('duplicate key value contains private@example.com'), {
      code: '23505'
    })
    const error = new Error(
      'Failed query: select * from "user" where "email" = $1\nparams: private@example.com',
      {
        cause
      }
    )

    const message = getErrorMessage(error)

    expect(message).toBe('Database query failed (23505)')
    expect(message).not.toContain('private@example.com')
    expect(message).not.toContain('select')
  })

  test('removes an appended parameter block from generic errors', () => {
    expect(getErrorMessage(new Error('Request failed\nparams: private-token'))).toBe(
      'Request failed'
    )
  })

  test.each([undefined, null, { code: 23505 }, { code: 'invalid' }])(
    'uses the safe fallback when the database cause is invalid: %j',
    (cause) => {
      const error = new Error('Failed query: select private_data\nparams: private-token', {
        cause
      })

      const message = getErrorMessage(error)

      expect(message).toBe('Database query failed')
      expect(message).not.toContain('private')
    }
  )

  test('accepts a valid code without exposing other cause properties', () => {
    const error = new Error('Failed query: select private_data', {
      cause: { code: '23505', detail: 'private-token' }
    })

    expect(getErrorMessage(error)).toBe('Database query failed (23505)')
  })
})
