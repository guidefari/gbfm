import type { Schema } from 'effect'

import { anonymousPrincipal, parsePrincipal, type Principal } from '@/lib/auth/principal'
import { apiRequest } from '@/lib/server/api/api-gateway'
import { log } from '@/services/logger'

type SessionResolution = {
  readonly principal: Principal
  readonly setCookies: ReadonlyArray<string>
}

const sessionTokenNames = new Set([
  'better-auth.session_token',
  '__Secure-better-auth.session_token',
])

const hasSessionToken = (cookieHeader: string | null): boolean =>
  cookieHeader
    ?.split(';')
    .some((cookie) => sessionTokenNames.has(cookie.trim().split('=', 1)[0] ?? '')) ?? false

/** Resolves a request's Better Auth session without leaking API response shapes. */
export async function resolvePrincipal(
  event: Parameters<typeof apiRequest>[0],
): Promise<SessionResolution> {
  if (
    !hasSessionToken(event.request.headers.get('cookie')) &&
    !event.request.headers.has('authorization')
  ) {
    return { principal: anonymousPrincipal, setCookies: [] }
  }

  try {
    const response = await apiRequest(event, '/auth/get-session')
    const setCookies = response.headers.getSetCookie()

    if (!response.ok) return { principal: anonymousPrincipal, setCookies }
    const input: Schema.Json = await response.json()

    return { principal: parsePrincipal(input), setCookies }
  } catch (cause: unknown) {
    log('error', 'session resolution failed', {
      operation: 'resolve-session',
      errorType: cause instanceof Error ? cause.name : 'UnknownError',
      requestId: event.locals.requestId,
    })

    return { principal: anonymousPrincipal, setCookies: [] }
  }
}
