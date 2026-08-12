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
  test('adds JSON content type and includes credentials by default', async () => {
    let observedInit: RequestInit | undefined
    const fetcher = createFetcher({
      request: async (_input, init) => {
        observedInit = init
        return jsonResponse({ ok: true })
      },
      logError: () => {}
    })

    await expect(fetcher('/api/test')).resolves.toEqual({ ok: true })

    expect(observedInit?.credentials).toBe('include')
    expect(new Headers(observedInit?.headers).get('Content-Type')).toBe('application/json')
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

  test('returns undefined for empty successful responses', async () => {
    const fetcher = createFetcher({
      request: async () => new Response('', { status: 200 }),
      logError: () => {}
    })

    await expect(fetcher('/api/empty')).resolves.toBeUndefined()
  })

  test('redirects on 401 before throwing unauthorized', async () => {
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

  test('reports server responses with request context', async () => {
    let failure: ApiFailureInput | undefined
    const fetcher = createFetcher({
      request: async () => new Response('failed', { status: 500, statusText: 'Server Error' }),
      reportFailure: (input) => {
        failure = input
        return Effect.void
      },
      runEffect: Effect.runPromise,
      logError: () => {}
    })

    await expect(fetcher('/api/broken', { method: 'PATCH' })).rejects.toThrow('HTTP 500: failed')
    expect(failure?.input).toBe('/api/broken')
    expect(failure?.init.method).toBe('PATCH')
    expect(failure?.context).toEqual({
      status: 500,
      statusText: 'Server Error',
      failureType: 'server_response'
    })
  })

  test('reports network TypeError failures', async () => {
    let failure: ApiFailureInput | undefined
    const fetcher = createFetcher({
      request: async () => {
        throw new TypeError('network down')
      },
      reportFailure: (input) => {
        failure = input
        return Effect.void
      },
      runEffect: Effect.runPromise,
      logError: () => {}
    })

    await expect(fetcher('/api/network')).rejects.toThrow('network down')
    expect(failure?.context).toEqual({ failureType: 'network' })
  })

  test('logs thrown failures', async () => {
    const logError = vi.fn()
    const error = new Error('boom')
    const fetcher = createFetcher({
      request: async () => {
        throw error
      },
      logError
    })

    await expect(fetcher('/api/boom')).rejects.toThrow('boom')
    expect(logError).toHaveBeenCalledWith(error, {
      url: '/api/boom',
      method: 'GET'
    })
  })
})

describe('request metadata helpers', () => {
  test('reads URL and method from string requests', () => {
    expect(getRequestUrl('/api/test')).toBe('/api/test')
    expect(getRequestMethod('/api/test', { method: 'POST' })).toBe('POST')
  })

  test('reads URL and method from Request objects', () => {
    const request = new Request('https://www.goosebumps.fm/api/test', { method: 'DELETE' })

    expect(getRequestUrl(request)).toBe('https://www.goosebumps.fm/api/test')
    expect(getRequestMethod(request, {})).toBe('DELETE')
  })
})
