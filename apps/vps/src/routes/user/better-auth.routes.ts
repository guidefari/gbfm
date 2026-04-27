import { Effect } from 'effect'
import { Hono } from 'hono'
import { auth } from '@/lib/auth'
import {
  clearSignupRequestParentSpan,
  runWithSignupTraceId,
  setSignupRequestParentSpan,
  toAuthTracingError
} from '@/lib/auth-tracing'
import { runApp } from '@/runtime'

const betterAuthApp = new Hono()

function createAuthTraceId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function prepareAuthRequest(request: Request) {
  const url = new URL(request.url)
  const isSignupRequest =
    request.method === 'POST' && url.pathname.endsWith('/sign-up/email')
  const hasOrigin =
    request.headers.has('origin') || request.headers.has('referer')
  const headers = new Headers(request.headers)
  let mutated = false

  if (
    request.method === 'POST' &&
    !hasOrigin &&
    request.headers.has('cookie')
  ) {
    headers.delete('cookie')
    mutated = true
  }

  let traceId: string | null = null
  let startedAt: number | null = null

  if (isSignupRequest) {
    traceId = headers.get('x-auth-trace-id') ?? createAuthTraceId()
    startedAt = Number(headers.get('x-auth-trace-started-at') ?? Date.now())
    headers.set('x-auth-trace-id', traceId)
    headers.set('x-auth-trace-started-at', String(startedAt))
    mutated = true
  }

  return {
    request: mutated
      ? new Request(request, {
          headers
        })
      : request,
    isSignupRequest,
    traceId,
    startedAt
  }
}

betterAuthApp.on(['POST', 'GET'], '*', async (c) => {
  const prepared = prepareAuthRequest(c.req.raw)

  if (!prepared.isSignupRequest || !prepared.traceId) {
    return auth.handler(prepared.request)
  }

  const traceId = prepared.traceId
  const url = new URL(prepared.request.url)

  const program = Effect.gen(function* () {
    const span = yield* Effect.currentSpan

    yield* Effect.sync(() => {
      setSignupRequestParentSpan(traceId, span)
    })

    const response = yield* Effect.tryPromise({
      try: () =>
        runWithSignupTraceId(traceId, () => auth.handler(prepared.request)),
      catch: (cause) => toAuthTracingError('auth.handler.signUpEmail', cause)
    })

    yield* Effect.annotateCurrentSpan(
      'http.response.status_code',
      response.status
    )

    return response
  }).pipe(
    Effect.ensuring(
      Effect.sync(() => {
        clearSignupRequestParentSpan(traceId)
      })
    ),
    Effect.withSpan('api.auth.signUpEmail', {
      attributes: {
        'auth.trace_id': traceId,
        'http.request.method': prepared.request.method,
        'url.path': url.pathname
      }
    })
  )

  return runApp(program)
})

export default betterAuthApp
