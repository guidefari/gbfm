import type { Context, Next } from 'hono'
import { verify } from 'hono/jwt'
import { getUserByEmailOrId } from '@/db/user.repo'
import { env } from '@/env'
import type { AppBindings } from '@/lib/types'

/**
 * Authenticates a user by verifying the JWT token in the Authorization header.
 * 
 * @example
 * ```ts
import { authenticate } from './middleware/auth'

// Apply to specific routes
auth.get('/protected-route', authenticate, async (c) => {
  const user = c.get('user')
  return c.json({ message: 'Protected data', user })
})

// Or apply to all routes in a group
const protectedRoutes = new Hono()
protectedRoutes.use('*', authenticate)

protectedRoutes.get('/profile', async (c) => {
  const user = c.get('user')
  return c.json({ user })
})
 */
export const authenticate = async (c: Context<AppBindings>, next: Next) => {
  const authHeader = c.req.header('Authorization')

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Authorization header required' }, 401)
  }

  const token = authHeader.substring(7)

  try {
    const payload = await verify(token, env.ACCESS_TOKEN_SECRET)

    if (payload.type !== 'access') {
      return c.json({ error: 'Invalid token type' }, 401)
    }

    const userId = payload.sub
    if (!userId || typeof userId !== 'string') {
      return c.json({ error: 'Invalid token payload' }, 401)
    }

    const user = await getUserByEmailOrId({ userId })
    if (user.length === 0 || !user[0]) {
      return c.json({ error: 'User not found' }, 404)
    }

    c.set('user', user[0])
    await next()
  } catch (_error) {
    return c.json({ error: 'Invalid or expired token' }, 401)
  }
}
