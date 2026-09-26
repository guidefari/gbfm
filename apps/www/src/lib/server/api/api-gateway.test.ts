import { describe, expect, test } from 'vitest'

import { apiRequest } from './api-gateway'

type BindingInit = {
  readonly method?: string
  readonly headers?: Readonly<Record<string, string>>
  readonly redirect?: RequestRedirect
  readonly body?: ArrayBuffer
  readonly signal?: AbortSignal
}

describe('apiRequest request correlation', () => {
  test('forwards the WWW request ID through the API service binding', async () => {
    let received: Request | undefined

    const api = {
      fetch: async (input: string, init?: BindingInit) => {
        received = new Request(input, init)

        return new Response(null, { status: 204 })
      },
    }

    const event = {
      locals: { apiOrigin: 'http://127.0.0.1:3003', requestId: 'www-request-123' },
      request: new Request('https://www.goosebumps.fm/shows/example'),
      platform: { env: { API: api } },
    }

    const response = await apiRequest(event, '/api/shows/example')

    expect(response.status).toBe(204)
    expect(received?.headers.get('x-request-id')).toBe('www-request-123')
    expect(received?.url).toBe('https://api.internal/api/shows/example')
  })

  test('preserves cancellation and response cookies across the service binding', async () => {
    const controller = new AbortController()
    let received: Request | undefined

    const api = {
      fetch: async (input: string, init?: BindingInit) => {
        received = new Request(input, init)
        const headers = new Headers()
        headers.append('set-cookie', 'session_token=refreshed; Path=/; HttpOnly')
        headers.append('set-cookie', 'session_data=cached; Path=/; HttpOnly')

        return new Response(null, { status: 204, headers })
      },
    }

    const event = {
      locals: { apiOrigin: 'http://127.0.0.1:3003', requestId: 'www-request-456' },
      request: new Request('https://www.goosebumps.fm/shows/example'),
      platform: { env: { API: api } },
    }

    const response = await apiRequest(event, '/api/favorites', { signal: controller.signal })
    controller.abort()

    expect(received?.signal.aborted).toBe(true)
    expect(response.headers.getSetCookie()).toEqual([
      'session_token=refreshed; Path=/; HttpOnly',
      'session_data=cached; Path=/; HttpOnly',
    ])
  })
})
