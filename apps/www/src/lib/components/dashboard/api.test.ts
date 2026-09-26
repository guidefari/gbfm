import { Schema } from 'effect'
import { afterEach, describe, expect, test, vi } from 'vitest'

import { DashboardRequestError, dashboardCommand, dashboardJson, jsonRequest } from './api'

const Result = Schema.Struct({ value: Schema.String })

afterEach(() => {
  vi.unstubAllGlobals()
})

describe.sequential('dashboard HTTP client', () => {
  test('executes credentialed requests and decodes JSON through the response schema', async () => {
    const fetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(init?.credentials).toBe('include')
      expect(init?.method).toBe('POST')
      expect(new Headers(init?.headers).get('content-type')).toBe('application/json')

      return Response.json({ value: 'saved' })
    })

    vi.stubGlobal('fetch', fetch)

    await expect(
      dashboardJson(Result, 'https://www.goosebumps.fm/api/test', jsonRequest('POST', { id: 1 })),
    ).resolves.toEqual({ value: 'saved' })
    expect(fetch).toHaveBeenCalledOnce()
  })

  test('rejects unsuccessful responses with their status', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 403 })),
    )

    await expect(dashboardJson(Result, 'https://www.goosebumps.fm/api/test')).rejects.toEqual(
      new DashboardRequestError({ status: 403 }),
    )
  })

  test('accepts an empty successful command response without decoding a body', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 204 })),
    )

    await expect(
      dashboardCommand('https://www.goosebumps.fm/api/test', { method: 'DELETE' }),
    ).resolves.toBeUndefined()
  })

  test('preserves multipart bodies without forcing a JSON content type', async () => {
    const body = new FormData()
    body.set('avatar', new Blob(['image'], { type: 'image/png' }), 'avatar.png')

    const fetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(init?.body).toBe(body)
      expect(new Headers(init?.headers).has('content-type')).toBe(false)

      return Response.json({ value: 'uploaded' })
    })

    vi.stubGlobal('fetch', fetch)

    await expect(
      dashboardJson(Result, 'https://www.goosebumps.fm/api/test', { method: 'PATCH', body }),
    ).resolves.toEqual({ value: 'uploaded' })
  })
})
