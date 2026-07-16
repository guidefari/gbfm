import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createWebHandler } from './routes'

// Step 3b (docs/migration-effect-http-api.md): validates AuthMiddleware's
// cookie-reading and 401 path against a real HttpApiEndpoint, ahead of any
// real authed route depending on it. The 200/authenticated path isn't
// covered here -- no existing test in this codebase creates a real
// better-auth session, and building that harness is bigger than this step's
// scope (validating rejection, not building session-creation tooling).
let webHandler: ReturnType<typeof createWebHandler>

beforeAll(async () => {
  // Imported for its side effects (SentryService init, background forks) --
  // no route serving lives here since step 8 removed the Hono app entirely.
  await import('@/app')
  webHandler = createWebHandler()
})

afterAll(async () => {
  await webHandler.dispose()
})

describe('AuthMiddleware (internal group)', () => {
  it('GET /api/internal/whoami returns 401 without a session cookie', async () => {
    const res = await webHandler.handler(new Request('http://localhost/api/internal/whoami'))

    expect(res.status).toBe(401)
  })

  it('GET /api/internal/whoami returns 401 with an invalid session cookie', async () => {
    const res = await webHandler.handler(
      new Request('http://localhost/api/internal/whoami', {
        headers: { cookie: 'better-auth.session_token=not-a-real-session' }
      })
    )

    expect(res.status).toBe(401)
  })
})
