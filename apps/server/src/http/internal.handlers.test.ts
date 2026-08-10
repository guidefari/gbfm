import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { d1 } from '@/test/database'
import { createTestWebHandler } from '@/test/http-handler'
import { createWebHandler } from './routes'

// Step 3b (docs/migration-effect-http-api.md): validates AuthMiddleware's
// cookie-reading and 401 path against a real HttpApiEndpoint, ahead of any
// real authed route depending on it. The 200/authenticated path isn't
// covered here -- no existing test in this codebase creates a real
// better-auth session, and building that harness is bigger than this step's
// scope (validating rejection, not building session-creation tooling).
let webHandler: ReturnType<typeof createWebHandler>

beforeAll(async () => {
  // No longer imports @/app for its side effects: app.ts's initializeApp
  // runs against the module-level runtime singleton (src/runtime/index.ts),
  // which now intentionally dies resolving Database outside the Worker
  // request path (OPS-254). createTestWebHandler mirrors worker.ts's
  // per-request AppLayer composition instead, including its own
  // SentryServiceLayer, so nothing here depends on @/app's side effects.
  webHandler = createTestWebHandler(d1)
})

afterAll(async () => {
  await webHandler?.dispose()
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
