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

  it('GET /api/music/artists falls through to the Hono app', async () => {
    const res = await webHandler.handler(new Request('http://localhost/api/music/artists'))

    expect(res.status).toBe(200)
    const body: unknown = await res.json()
    expect(Array.isArray(body)).toBe(true)
  })

  it('unknown routes fall through to the Hono app and 404', async () => {
    const res = await webHandler.handler(new Request('http://localhost/does-not-exist'))

    expect(res.status).toBe(404)
  })
})
