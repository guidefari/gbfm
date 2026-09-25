import type { RequestEvent } from '@sveltejs/kit'
import { Schema } from 'effect'
import { anonymousPrincipal, parsePrincipal, type Principal } from '@/lib/auth/principal'
import { apiRequest } from '@/lib/server/api/api-gateway'

/** Resolves a request's Better Auth session without leaking API response shapes. */
export async function resolvePrincipal(
  event: Pick<RequestEvent, 'platform' | 'request' | 'locals'>
): Promise<Principal> {
  try {
    const response = await apiRequest(event, '/auth/get-session')
    if (!response.ok) return anonymousPrincipal
    const input: Schema.Json = await response.json()
    return parsePrincipal(input)
  } catch (cause: unknown) {
    console.error('session resolution failed', {
      operation: 'resolve-session',
      errorType: cause instanceof Error ? cause.name : 'UnknownError',
      requestId: event.locals.requestId
    })
    return anonymousPrincipal
  }
}
