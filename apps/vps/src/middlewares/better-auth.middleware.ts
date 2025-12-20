import type { Context, Next } from 'hono'
import { auth } from '@/lib/auth'
import type { AppBindings } from '@/lib/types'

export const betterAuthMiddleware = async (c: Context<AppBindings>, next: Next) => {
  const session = await auth.api.getSession({
    headers: c.req.raw.headers
  })

  if (!session) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  c.set('user', session.user)
  c.set('session', session.session)
  await next()
}
