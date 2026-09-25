import { describe, expect, it } from 'vitest'
import { HttpApiError } from 'effect/unstable/httpapi'
import * as HttpClientError from 'effect/unstable/http/HttpClientError'
import * as HttpClientRequest from 'effect/unstable/http/HttpClientRequest'
import * as HttpClientResponse from 'effect/unstable/http/HttpClientResponse'
import { isNotFoundError, nullOnNotFound } from './http-errors'

describe('isNotFoundError', () => {
  it('recognizes only the typed HTTP API not-found error', () => {
    expect(isNotFoundError(new HttpApiError.NotFound())).toBe(true)
    expect(isNotFoundError(new Error('HTTP 404: Not found'))).toBe(false)
  })

  it('maps only typed not-found failures to null', async () => {
    await expect(nullOnNotFound(Promise.reject(new HttpApiError.NotFound()))).resolves.toBeNull()
    await expect(nullOnNotFound(Promise.reject(new Error('network failed')))).rejects.toThrow(
      'network failed'
    )
  })

  it('maps a remote API 404 response to null', async () => {
    const request = HttpClientRequest.get('https://api.example.test/missing')
    const response = HttpClientResponse.fromWeb(request, new Response(null, { status: 404 }))
    const cause = new HttpClientError.HttpClientError({
      reason: new HttpClientError.StatusCodeError({ request, response })
    })

    await expect(nullOnNotFound(Promise.reject(cause))).resolves.toBeNull()
  })
})
