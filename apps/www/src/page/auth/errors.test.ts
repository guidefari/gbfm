import { expect, it } from 'vitest'

import {
  authErrorKey,
  authErrorLocation,
  authErrorMessage,
  authErrorMessages,
  readAuthErrorCode,
} from './errors'

it('maps better-auth error codes to form error keys', () => {
  expect(authErrorKey(401, 'INVALID_EMAIL_OR_PASSWORD')).toBe('credentials')
  expect(authErrorKey(422, 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL')).toBe('exists')
  expect(authErrorKey(400, 'PASSWORD_TOO_SHORT')).toBe('password')
  expect(authErrorKey(400, 'INVALID_TOKEN')).toBe('token')
})

it('treats rate limiting and unrecognised codes as their own cases', () => {
  expect(authErrorKey(429, '')).toBe('rate')
  expect(authErrorKey(400, 'SOMETHING_NEW')).toBe('unknown')
})

it('reads the error code from a response, tolerating unreadable bodies', async () => {
  expect(await readAuthErrorCode(Response.json({ code: 'INVALID_TOKEN' }))).toBe('INVALID_TOKEN')
  expect(await readAuthErrorCode(new Response('Internal Server Error'))).toBe('')
})

it('resolves messages from the query value, falling back for unknown keys', () => {
  expect(authErrorMessage(null)).toBe(null)
  expect(authErrorMessage('exists')).toBe(authErrorMessages.exists)
  expect(authErrorMessage('constructor')).toBe(authErrorMessages.unknown)
})

it('sends the user back to the same form with context preserved', () => {
  expect(
    authErrorLocation('/auth/sign-in', 'credentials', { returnTo: '/privacy', token: '' }),
  ).toBe('/auth/sign-in?error=credentials&returnTo=%2Fprivacy')
  expect(authErrorLocation('/auth/reset-password', 'token', { returnTo: '', token: 'abc' })).toBe(
    '/auth/reset-password?error=token&token=abc',
  )
})
