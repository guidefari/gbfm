import * as Option from 'effect/Option'
import * as Schema from 'effect/Schema'

import { verifyPreviewGrant } from '../../../packages/core/src/media-preview'

const cookieName = '__Secure-gbfm-preview'

const parseSession = Schema.decodeUnknownOption(Schema.Struct({ grant: Schema.String }), {
  onExcessProperty: 'error',
})

/** Matches one exact HTTPS origin in the configured comma-delimited frontend allowlist. */
export function approvedPreviewOrigin(request: Request, env: Env): string | null {
  const origin = request.headers.get('origin')

  if (origin === null) return null

  try {
    const url = new URL(origin)

    if (url.protocol !== 'https:' || url.origin !== origin) return null
  } catch {
    return null
  }

  return env.MEDIA_PREVIEW_ORIGIN?.split(',').some((allowed) => allowed.trim() === origin)
    ? origin
    : null
}

/** Applies credentialed CORS and overrides all object/transform caching for private responses. */
export function privateResponse(response: Response, request: Request, env: Env): Response {
  response.headers.set('cache-control', 'private, no-store')
  response.headers.set('vary', 'Origin')
  response.headers.delete('access-control-allow-origin')
  response.headers.delete('access-control-allow-credentials')
  const origin = approvedPreviewOrigin(request, env)

  if (origin !== null) {
    response.headers.set('access-control-allow-origin', origin)
    response.headers.set('access-control-allow-credentials', 'true')
  }

  response.headers.set('access-control-allow-methods', 'GET, HEAD, POST, OPTIONS')
  response.headers.set(
    'access-control-allow-headers',
    'Content-Type, Range, If-None-Match, If-Modified-Since',
  )
  response.headers.set('access-control-expose-headers', 'ETag, Content-Range, Content-Length')

  return response
}

/** Verifies every duplicate named cookie independently against the exact requested asset. */
export async function hasPreviewCookie(
  request: Request,
  secret: string,
  audience: string,
  path: string,
): Promise<boolean> {
  const now = Date.now()

  for (const cookie of (request.headers.get('cookie') ?? '').split(';')) {
    const separator = cookie.indexOf('=')

    if (separator < 0 || cookie.slice(0, separator).trim() !== cookieName) continue

    const claims = await verifyPreviewGrant(
      cookie.slice(separator + 1).trim(),
      secret,
      audience,
      now,
    )

    if (claims?.path === path) return true
  }

  return false
}

/** Exchanges an origin-bound grant for a host-only, exact-path bearer cookie. */
export async function previewSession(request: Request, env: Env): Promise<Response> {
  const reply = (status: number) => privateResponse(new Response(null, { status }), request, env)

  if (!env.MEDIA_PREVIEW_KEY || !env.MEDIA_PREVIEW_ORIGIN) return reply(503)

  if (approvedPreviewOrigin(request, env) === null) return reply(403)

  if (request.method === 'OPTIONS') return reply(204)

  if (request.method !== 'POST') return reply(405)

  if (request.headers.get('content-type')?.split(';')[0]?.trim() !== 'application/json')
    return reply(415)
  let raw: unknown

  try {
    const body = await request.text()

    if (body.length > 8192) return reply(400)
    raw = JSON.parse(body)
  } catch {
    return reply(400)
  }

  const session = Option.getOrNull(parseSession(raw))

  if (session === null) return reply(400)
  const now = Date.now()

  const claims = await verifyPreviewGrant(
    session.grant,
    env.MEDIA_PREVIEW_KEY,
    new URL(request.url).origin,
    now,
  )

  if (claims === null) return reply(403)
  const response = reply(204)
  response.headers.set(
    'set-cookie',
    `${cookieName}=${session.grant}; Path=${claims.path}; Max-Age=${Math.floor((claims.expiresAt - now) / 1000)}; HttpOnly; Secure; SameSite=Strict`,
  )

  return response
}
