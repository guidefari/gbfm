import { HealthLiveResponse, HealthReadyResponse } from '@gbfm/api/health'
import { decodeResponseBody } from '@gbfm/api/testing'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { AppType } from '@/app'
import { createWebHandler } from './routes'

// Step 2a (docs/migration-effect-http-api.md): the Effect toWebHandler + Hono
// fallback must behave identically to the plain Hono app it wraps. Reuses the
// same @gbfm/api schemas as the 1b blackbox suite so both point at one contract.
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
  it('GET /health/live matches the Hono app', async () => {
    const res = await webHandler.handler(new Request('http://localhost/health/live'))

    expect(res.status).toBe(200)
    await expect(decodeResponseBody(HealthLiveResponse, res)).resolves.toEqual({ ok: true })
  })

  it('GET /health/ready matches the Hono app', async () => {
    const res = await webHandler.handler(new Request('http://localhost/health/ready'))

    expect(res.status).toBe(200)
    await expect(decodeResponseBody(HealthReadyResponse, res)).resolves.toEqual({
      dbConnected: true
    })
  })

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
