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
        headers.append('set-cookie', 'session_token=refreshed; Path=/; HttpOnly')
        headers.append('set-cookie', 'session_data=cached; Path=/; HttpOnly')

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
      request: new Request('https://www.goosebumps.fm/dashboard'),
      platform: { env: { API: api } },
    })

    expect(resolution.principal).toMatchObject({ userId: 'listener-1' })
    expect(resolution.setCookies).toEqual([
      'session_token=refreshed; Path=/; HttpOnly',
      'session_data=cached; Path=/; HttpOnly',
    ])
  })
})
