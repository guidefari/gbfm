import { defineMiddleware } from 'astro:middleware'
import { canCreatePosts } from '@gbfm/core/roles'
import * as Sentry from '@sentry/astro'
import { Effect, Schema } from 'effect'
import { buildHref } from '@/lib/navigation'
import type { PageAuth } from '@/lib/page'

const SessionResponse = Schema.Struct({
  user: Schema.Struct({
    id: Schema.String,
    name: Schema.String,
    email: Schema.String,
    role: Schema.optional(Schema.NullOr(Schema.String)),
    image: Schema.optional(Schema.NullOr(Schema.String))
  }),
  session: Schema.Unknown
})

const anonymous: PageAuth = { user: null, isAuthenticated: false }

const readAuth = async (
  request: Request
): Promise<{
  readonly auth: PageAuth
  readonly setCookie: string | null
}> => {
  const apiOrigin = import.meta.env.VITE_VPS_BASE_URL || new URL(request.url).origin
  try {
    const response = await fetch(new URL('/auth/get-session', apiOrigin), {
      headers: {
        cookie: request.headers.get('cookie') ?? ''
      },
      redirect: 'manual'
    })
    const setCookie = response.headers.get('set-cookie')
    if (!response.ok) return { auth: anonymous, setCookie }

    const input: unknown = await response.json()
    let parsed: typeof SessionResponse.Type
    try {
      parsed = Effect.runSync(Schema.decodeUnknownEffect(SessionResponse)(input))
    } catch (cause) {
      Sentry.captureException(cause, {
        tags: { boundary: 'astro-session-response' }
      })
      return { auth: anonymous, setCookie }
    }
    return {
      auth: { user: parsed.user, isAuthenticated: true },
      setCookie
    }
  } catch {
    return { auth: anonymous, setCookie: null }
  }
}

const attachSessionCookie = (response: Response, setCookie: string | null): Response => {
  if (setCookie !== null) response.headers.append('set-cookie', setCookie)
  return response
}

/** Resolves the Better Auth session and enforces server-owned route access. */
export const onRequest = defineMiddleware(async ({ locals, redirect, request, url }, next) => {
  const { auth, setCookie } = await readAuth(request)
  locals.auth = auth

  if (url.pathname === '/dashboard' || url.pathname.startsWith('/dashboard/')) {
    if (!auth.isAuthenticated) {
      return attachSessionCookie(
        redirect(buildHref({ to: '/auth/sign-in', search: { redirect: url.href } })),
        setCookie
      )
    }
    if (url.pathname.startsWith('/dashboard/content/') && !canCreatePosts(auth.user?.role)) {
      return attachSessionCookie(redirect('/dashboard'), setCookie)
    }
  }

  return attachSessionCookie(await next(), setCookie)
})
