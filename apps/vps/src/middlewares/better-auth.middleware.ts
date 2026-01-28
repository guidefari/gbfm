import { Effect } from 'effect'
import type { Context, Next } from 'hono'
import { auth } from '@/lib/auth'
import type { AppBindings } from '@/lib/types'

export const betterAuthMiddleware = async (
  c: Context<AppBindings>,
  next: Next
) => {
  const session = await auth.api.getSession({
    headers: c.req.raw.headers
  })

  if (!session) {
    Effect.logWarning('[Auth] Unauthorized access attempt', {
      path: c.req.path,
      method: c.req.method,
      ip:
        c.req.header('x-forwarded-for') ||
        c.req.header('x-real-ip') ||
        'unknown'
    }).pipe(Effect.runPromise)

    return c.json({ error: 'Unauthorized' }, 401)
  }

  // Set user context for downstream handlers
  c.set('user', session.user)
  c.set('session', session.session)

  Effect.logInfo('[Auth] Session validated', {
    userId: session.user.id,
    email: session.user.email,
    path: c.req.path,
    method: c.req.method
  }).pipe(Effect.runPromise)

  await next()
}

export const attachSessionContext = async (
  c: Context<AppBindings>,
  next: Next
) => {
  const session = await auth.api.getSession({
    headers: c.req.raw.headers
  })

  if (session) {
    // Set user context for downstream handlers
    c.set('user', session.user)
    c.set('session', session.session)

    Effect.logInfo('[Auth] Session validated', {
      userId: session.user.id,
      email: session.user.email,
      path: c.req.path,
      method: c.req.method
    }).pipe(Effect.runPromise)
  }

  await next()
}
