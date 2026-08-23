import { Schema } from 'effect'
import { afterEach, expect, test, vi } from 'vitest'
import { getProfile, login, loginRequestSchema, loginResponseSchema, userSchema } from './auth'

afterEach(() => {
  vi.unstubAllGlobals()
})

test('auth schemas preserve email, password, and unknown-key behavior', () => {
  const decodeLoginRequest = Schema.decodeUnknownSync(loginRequestSchema)
  const decodeLoginResponse = Schema.decodeUnknownSync(loginResponseSchema)
  const decodeUser = Schema.decodeUnknownSync(userSchema)

  expect(
    decodeLoginRequest({
      email: "name.o'neil+radio@example.co.uk",
      password: ' ',
      ignored: true
    })
  ).toEqual({ email: "name.o'neil+radio@example.co.uk", password: ' ' })
  expect(() => decodeLoginRequest({ email: '.name@example.com', password: 'password' })).toThrow()
  expect(() =>
    decodeLoginRequest({ email: 'name..radio@example.com', password: 'password' })
  ).toThrow()
  expect(() => decodeLoginRequest({ email: 'name@example.c', password: 'password' })).toThrow()
  expect(() => decodeLoginRequest({ email: 'name@example.com', password: '' })).toThrow()

  expect(
    decodeLoginResponse({
      user: {
        id: 'user-1',
        name: 'DJ Example',
        username: null,
        email: 'dj@example.com',
        avatarUrl: null,
        verified: true,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-02T00:00:00.000Z',
        ignored: true
      },
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      ignored: true
    })
  ).toEqual({
    user: {
      id: 'user-1',
      name: 'DJ Example',
      username: null,
      email: 'dj@example.com',
      avatarUrl: null,
      verified: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z'
    },
    accessToken: 'access-token',
    refreshToken: 'refresh-token'
  })
  expect(
    decodeUser({
      id: 'user-1',
      name: 'DJ Example',
      username: null,
      email: 'dj@example.com',
      avatarUrl: null,
      ignored: true
    })
  ).not.toHaveProperty('ignored')
})

test('login retains its Promise API and normalizes Better Auth dates and omitted images', async () => {
  vi.stubGlobal('fetch', async () => ({
    status: 200,
    statusText: 'OK',
    ok: true,
    json: async () => ({
      user: {
        id: 'user-1',
        name: 'DJ Example',
        email: 'dj@example.com',
        emailVerified: true,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: '2026-01-02T00:00:00.000Z'
      },
      token: 'session-token'
    })
  }))

  const result = login('https://example.com', {
    email: 'dj@example.com',
    password: 'password'
  })

  expect(result).toBeInstanceOf(Promise)
  await expect(result).resolves.toEqual({
    user: {
      id: 'user-1',
      name: 'DJ Example',
      username: 'DJ Example',
      email: 'dj@example.com',
      avatarUrl: null,
      verified: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z'
    },
    accessToken: 'session-token',
    refreshToken: 'session-token'
  })
})

test('profile validation distinguishes response structure from user data', async () => {
  vi.stubGlobal('fetch', async () => ({
    status: 200,
    statusText: 'OK',
    ok: true,
    json: async () => ({ unexpected: true })
  }))

  await expect(getProfile('https://example.com', 'token')).rejects.toMatchObject({
    _tag: 'AuthError',
    message: 'Invalid profile response structure',
    cause: { _tag: 'SchemaError' }
  })

  vi.stubGlobal('fetch', async () => ({
    status: 200,
    statusText: 'OK',
    ok: true,
    json: async () => ({ user: { id: 'user-1' } })
  }))

  await expect(getProfile('https://example.com', 'token')).rejects.toMatchObject({
    _tag: 'AuthError',
    message: 'Invalid user data format',
    cause: { _tag: 'SchemaError' }
  })
})
