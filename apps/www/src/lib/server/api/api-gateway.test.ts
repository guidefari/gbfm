import type { RequestEvent } from '@sveltejs/kit'
import { describe, expect, test, vi } from 'vitest'

vi.mock('$app/env/private', () => ({ VPS_PROXY_TARGET: undefined }))

import { apiRequest } from './api-gateway'

describe('apiRequest request correlation', () => {
  test('forwards the WWW request ID through the API service binding', async () => {
    let received: Request | undefined
    const api = {
      fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
        received = new Request(input, init)

        return new Response(null, { status: 204 })
      },
    }
    const event = {
      locals: { requestId: 'www-request-123' },
      request: new Request('https://www.goosebumps.fm/shows/example'),
      platform: { env: { API: api } },
    } as unknown as Pick<RequestEvent, 'platform' | 'request' | 'locals'>

    const response = await apiRequest(event, '/api/shows/example')

    expect(response.status).toBe(204)
    expect(received?.headers.get('x-request-id')).toBe('www-request-123')
    expect(received?.url).toBe('https://api.internal/api/shows/example')
  })
})
