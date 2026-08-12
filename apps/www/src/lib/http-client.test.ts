import * as Effect from 'effect/Effect'
import { describe, expect, test, vi } from 'vitest'
import { createFetcher, getRequestMethod, getRequestUrl, type ApiFailureInput } from './http-client'

type JsonValue =
  | string
  | number
  | boolean
  | null
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue }

function jsonResponse(body: JsonValue, init?: ResponseInit) {
  return new Response(JSON.stringify(body), init)
}

describe('createFetcher', () => {
  test('performs default JSON requests and accepts empty success responses', async () => {
    const observed: RequestInit[] = []
    const fetcher = createFetcher({
      request: async (_input, init) => {
        observed.push(init ?? {})
        return observed.length === 1
          ? jsonResponse({ ok: true })
          : new Response('', { status: 200 })
      },
      logError: () => {}
    })

    await expect(fetcher('/api/test')).resolves.toEqual({ ok: true })
    await expect(fetcher('/api/empty')).resolves.toBeUndefined()

    expect(observed[0]?.credentials).toBe('include')
    expect(new Headers(observed[0]?.headers).get('Content-Type')).toBe('application/json')
  })

  test('does not add JSON content type for FormData bodies', async () => {
    let observedInit: RequestInit | undefined
    const body = new FormData()
    const fetcher = createFetcher({
      request: async (_input, init) => {
        observedInit = init
        return jsonResponse({ ok: true })
      },
      logError: () => {}
    })

    await fetcher('/api/upload', { method: 'POST', body })

    expect([...new Headers(observedInit?.headers)]).toEqual([])
  })

  test('redirects and rejects unauthorized responses', async () => {
    let redirected = false
    const fetcher = createFetcher({
      request: async () => new Response('nope', { status: 401 }),
      onUnauthorized: () => {
        redirected = true
      },
      logError: () => {}
    })

    await expect(fetcher('/api/private')).rejects.toThrow('Unauthorized')
    expect(redirected).toBe(true)
  })

  test('reports reportable failures and logs every rejected request with its context', async () => {
    const failures: ApiFailureInput[] = []
    const logError = vi.fn()
    const fetcher = createFetcher({
      request: vi
        .fn()
        .mockResolvedValueOnce(new Response('failed', { status: 500, statusText: 'Server Error' }))
        .mockRejectedValueOnce(new TypeError('network down'))
        .mockRejectedValueOnce(new Error('boom')),
      reportFailure: (input) => {
        failures.push(input)
        return Effect.void
      },
      runEffect: Effect.runPromise,
      logError
    })

    await expect(fetcher('/api/broken', { method: 'PATCH' })).rejects.toThrow('HTTP 500: failed')
    await expect(fetcher('/api/network')).rejects.toThrow('network down')
    await expect(fetcher('/api/boom')).rejects.toThrow('boom')

    expect(failures).toHaveLength(2)
    expect(failures[0]).toMatchObject({ input: '/api/broken', init: { method: 'PATCH' } })
    expect(failures[0]?.context).toEqual({
      status: 500,
      statusText: 'Server Error',
      failureType: 'server_response'
    })
    expect(failures[1]?.context).toEqual({ failureType: 'network' })
    expect(logError).toHaveBeenNthCalledWith(1, expect.any(Error), {
      url: '/api/broken',
      method: 'PATCH'
    })
    expect(logError).toHaveBeenNthCalledWith(2, expect.any(TypeError), {
      url: '/api/network',
      method: 'GET'
    })
    expect(logError).toHaveBeenNthCalledWith(3, expect.any(Error), {
      url: '/api/boom',
      method: 'GET'
    })
  })
})

describe('request metadata helpers', () => {
  test('derives effective URLs and methods from strings, URLs, requests, and overrides', () => {
    const url = new URL('https://www.goosebumps.fm/api/url')
    const request = new Request('https://www.goosebumps.fm/api/test', { method: 'DELETE' })

    expect(getRequestUrl('/api/test')).toBe('/api/test')
    expect(getRequestUrl(url)).toBe('https://www.goosebumps.fm/api/url')
    expect(getRequestUrl(request)).toBe('https://www.goosebumps.fm/api/test')
    expect(getRequestMethod('/api/test', {})).toBe('GET')
    expect(getRequestMethod('/api/test', { method: 'POST' })).toBe('POST')
    expect(getRequestMethod(request, {})).toBe('DELETE')
    expect(getRequestMethod(request, { method: 'PATCH' })).toBe('PATCH')
  })
})
