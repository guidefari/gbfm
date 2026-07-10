import { HealthLiveResponse, HealthReadyResponse } from '@gbfm/api/health'
import { decodeResponseBody } from '@gbfm/api/testing'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { AppType } from '@/app'
import { createWebHandler } from './routes'

// Blackbox suite asserting only the wire contract, so these assertions keep
// working as more groups move from the Hono fallback onto the Effect router
// (docs/migration-effect-http-api.md).
let app: AppType
let webHandler: ReturnType<typeof createWebHandler>

beforeAll(async () => {
  const mod = await import('@/app')
  app = mod.default
  webHandler = createWebHandler(app)
})

afterAll(async () => {
  await webHandler.dispose()
})

describe('Effect toWebHandler fallback', () => {
  it('GET /api/music/artists returns the same response as the plain Hono app', async () => {
    const [viaHandler, viaHono] = await Promise.all([
      webHandler.handler(new Request('http://localhost/api/music/artists')),
      app.request('/api/music/artists')
    ])

    expect(viaHandler.status).toBe(viaHono.status)
    await expect(viaHandler.json()).resolves.toEqual(await viaHono.json())
  })

  it('unknown routes fall through to the Hono app and 404', async () => {
    const res = await webHandler.handler(new Request('http://localhost/does-not-exist'))

    expect(res.status).toBe(404)
  })
})

describe('better-auth route (Step 2c)', () => {
  it('GET /auth/get-session is handled by the auth route, not the Hono fallback', async () => {
    const res = await webHandler.handler(new Request('http://localhost/auth/get-session'))

    // better-auth's own response for an unauthenticated session check, not a 404 --
    // proves /auth/* is matched ahead of the wildcard fallback.
    expect(res.status).toBe(200)
    expect(await res.json()).toBeNull()
  })

  it('unknown /auth/* paths are handled by better-auth (404 from better-auth, not the Hono fallback)', async () => {
    const withoutAuth = await webHandler.handler(new Request('http://localhost/does-not-exist'))
    const withAuth = await webHandler.handler(new Request('http://localhost/auth/does-not-exist'))

    expect(withoutAuth.status).toBe(404)
    expect(withAuth.status).toBe(404)
    // Different bodies would indicate the two 404s come from different sources
    // (Hono's notFound handler vs. better-auth's own routing).
    expect(await withAuth.text()).not.toEqual(await withoutAuth.text())
  })
})

describe('health (HttpApiBuilder group, Step 3a)', () => {
  it('GET /health/live returns 200 without checking the database', async () => {
    const res = await webHandler.handler(new Request('http://localhost/health/live'))

    expect(res.status).toBe(200)
    await expect(decodeResponseBody(HealthLiveResponse, res)).resolves.toEqual({ ok: true })
  })

  it('GET /health/ready and /health return 200 when the database check succeeds', async () => {
    const res = await webHandler.handler(new Request('http://localhost/health/ready'))
    const checkRes = await webHandler.handler(new Request('http://localhost/health'))

    expect(res.status).toBe(200)
    expect(checkRes.status).toBe(200)
    await expect(decodeResponseBody(HealthReadyResponse, res)).resolves.toEqual({
      dbConnected: true
    })
    await expect(decodeResponseBody(HealthReadyResponse, checkRes)).resolves.toEqual({
      dbConnected: true
    })
  })

  it('repeated readiness calls within the cache window keep returning 200', async () => {
    const first = await webHandler.handler(new Request('http://localhost/health/ready'))
    const second = await webHandler.handler(new Request('http://localhost/health/ready'))

    expect(first.status).toBe(200)
    expect(second.status).toBe(200)
  })

  it('responds 404 to unsupported methods on health paths', async () => {
    const res = await webHandler.handler(
      new Request('http://localhost/health/live', { method: 'POST' })
    )

    expect(res.status).toBe(404)
  })
})
