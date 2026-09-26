import { describe, expect, test } from 'vitest'

import { resolvePrincipal } from './session'

type BindingInit = {
  readonly method?: string
  readonly headers?: Readonly<Record<string, string>>
  readonly redirect?: RequestRedirect
  readonly body?: ArrayBuffer
}

describe('resolvePrincipal', () => {
  test('returns every refreshed Better Auth cookie for the page response', async () => {
    const api = {
      fetch: async (_input: string, _init?: BindingInit) => {
        const headers = new Headers()
        headers.append('set-cookie', 'better-auth.session_token=refreshed; Path=/; HttpOnly')
        headers.append('set-cookie', 'better-auth.session_data=cached; Path=/; HttpOnly')

        return Response.json(
          {
            session: {},
            user: {
              id: 'listener-1',
              name: 'Listener',
              email: 'listener@example.com',
              role: 'user',
            },
          },
          { headers },
        )
      },
    }

    const resolution = await resolvePrincipal({
      locals: { apiOrigin: 'http://127.0.0.1:3003', requestId: 'www-session-1' },
      request: new Request('https://www.goosebumps.fm/dashboard', {
        headers: { cookie: 'better-auth.session_token=signed-token' },
      }),
      platform: { env: { API: api } },
    })

    expect(resolution.principal).toMatchObject({ userId: 'listener-1' })
    expect(resolution.setCookies).toEqual([
      'better-auth.session_token=refreshed; Path=/; HttpOnly',
      'better-auth.session_data=cached; Path=/; HttpOnly',
    ])
  })

  test.each([
    undefined,
    'better-auth.session_data=cached',
    'other.session_token=unrelated; better-auth.session_token_extra=unrelated',
  ])('returns anonymous without a session token cookie (%s)', async (cookie) => {
    const requests: Array<string> = []

    const api = {
      fetch: async (input: string) => {
        requests.push(input)

        return Response.json(null)
      },
    }

    const resolution = await resolvePrincipal({
      locals: { apiOrigin: 'http://127.0.0.1:3003', requestId: 'www-session-2' },
      request: new Request('https://www.goosebumps.fm/dashboard', {
        headers: new Headers(cookie === undefined ? undefined : { cookie }),
      }),
      platform: { env: { API: api } },
    })

    expect(resolution.principal._tag).toBe('Anonymous')
    expect(resolution.setCookies).toEqual([])
    expect(requests).toEqual([])
  })

  test('looks up a secure-prefixed session token cookie', async () => {
    const requests: Array<string> = []

    const api = {
      fetch: async (input: string) => {
        requests.push(input)

        return Response.json(null)
      },
    }

    const resolution = await resolvePrincipal({
      locals: { apiOrigin: 'http://127.0.0.1:3003', requestId: 'www-session-3' },
      request: new Request('https://www.goosebumps.fm/dashboard', {
        headers: { cookie: 'other=value; __Secure-better-auth.session_token=signed-token' },
      }),
      platform: { env: { API: api } },
    })

    expect(resolution.principal._tag).toBe('Anonymous')
    expect(requests).toEqual(['https://api.internal/auth/get-session'])
  })

  test('passes bearer authorization through to session resolution without a cookie', async () => {
    const requests: Array<string> = []

    const api = {
      fetch: async (input: string) => {
        requests.push(input)

        return Response.json(null)
      },
    }

    await resolvePrincipal({
      locals: { apiOrigin: 'http://127.0.0.1:3003', requestId: 'www-session-4' },
      request: new Request('https://www.goosebumps.fm/dashboard', {
        headers: { authorization: 'Bearer signed-token' },
      }),
      platform: { env: { API: api } },
    })

    expect(requests).toEqual(['https://api.internal/auth/get-session'])
  })
})
