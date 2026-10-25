import { Cause, Effect, Exit, Layer, Logger, Redacted, Result } from 'effect'
import { FetchHttpClient, HttpClient, HttpClientResponse } from 'effect/http'
import { expect, test } from 'vitest'

import { withTestLayer } from '@/test/effect'

import { SignupProtection, SignupProtectionLayer } from './signup-protection'

test.each(['invalid-input-secret', 'missing-input-secret'])(
  '%s is an observable service failure without exposing credentials',
  async (code) => {
    const logs: Array<unknown> = []

    const client = HttpClient.make((request) =>
      Effect.succeed(
        HttpClientResponse.fromWeb(
          request,
          Response.json({
            success: false,
            'error-codes': [code, 'private-token'],
          }),
        ),
      ),
    )

    const protection = SignupProtectionLayer({
      secret: Redacted.make('private-secret'),
      hostnames: ['goosebumps.fm'],
      limit: async () => true,
    }).pipe(Layer.provide(Layer.succeed(HttpClient.HttpClient, client)))

    const result = await Effect.runPromise(
      withTestLayer(
        Effect.gen(function* () {
          const service = yield* SignupProtection

          return yield* Effect.result(
            service.authorize({
              token: 'private-token',
              ip: '192.0.2.1',
              action: 'newsletter-subscribe',
            }),
          )
        }),
        Layer.merge(protection, Logger.layer([Logger.make(({ message }) => logs.push(message))])),
      ),
    )

    expect(Result.isFailure(result) && result.failure.reason).toBe('unavailable')
    const diagnostic = JSON.stringify(logs)
    expect(diagnostic).toContain(code)
    expect(diagnostic).not.toContain('private-secret')
    expect(diagnostic).not.toContain('private-token')
  },
)

test.each(['interruption', 'timeout'] as const)(
  '%s cancels the outstanding siteverify transport',
  async (scenario) => {
    let started = () => {}

    const requestStarted = new Promise<void>((resolve) => {
      started = resolve
    })

    let aborted = false

    const transport: typeof fetch = Object.assign(
      (_url: string | URL | Request, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener(
            'abort',
            () => {
              aborted = true
              reject(new Error('aborted'))
            },
            { once: true },
          )
          started()
        }),
      { preconnect: () => {} },
    )

    const protection = SignupProtectionLayer({
      secret: Redacted.make('test-secret'),
      hostnames: ['goosebumps.fm'],
      limit: async () => true,
    }).pipe(
      Layer.provide(
        FetchHttpClient.layer.pipe(Layer.provide(Layer.succeed(FetchHttpClient.Fetch, transport))),
      ),
    )

    const controller = new AbortController()

    const completion = Effect.runPromiseExit(
      withTestLayer(
        Effect.gen(function* () {
          const service = yield* SignupProtection

          return yield* Effect.result(
            service.authorize({ token: 'test-token', ip: '192.0.2.1', action: 'account-signup' }),
          )
        }),
        protection,
      ),
      { signal: controller.signal },
    )

    await requestStarted

    if (scenario === 'interruption') controller.abort()

    const outcome = Exit.match(await completion, {
      onFailure: (cause) => (Cause.hasInterrupts(cause) ? 'interruption' : 'defect'),
      onSuccess: (result) => (Result.isFailure(result) ? result.failure.reason : 'allowed'),
    })

    expect(outcome).toBe(scenario === 'interruption' ? 'interruption' : 'unavailable')
    expect(aborted).toBe(true)
  },
  10_000,
)
