import { HealthLiveResponse, HealthReadyResponse } from '@gbfm/api/health'
import { decodeResponseBody } from '@gbfm/api/testing'
import { beforeAll, describe, expect, it } from 'vitest'
import type { AppType } from '@/app'

// Asserts only the wire contract (status, JSON body against @gbfm/api schemas) so these same assertions can run unchanged once health is ported to HttpApiBuilder (step 3a).
let app: AppType

beforeAll(async () => {
  const mod = await import('@/app')
  app = mod.default
})

describe('Health endpoints', () => {
  it('GET /health/live returns 200 with liveness JSON', async () => {
    const res = await app.request('/health/live')

    expect(res.status).toBe(200)
    await expect(decodeResponseBody(HealthLiveResponse, res)).resolves.toEqual({ ok: true })
  })

  it('GET /health/ready returns 200 with readiness JSON when the database is reachable', async () => {
    const res = await app.request('/health/ready')

    expect(res.status).toBe(200)
    await expect(decodeResponseBody(HealthReadyResponse, res)).resolves.toEqual({
      dbConnected: true
    })
  })

  it('GET /health returns the same readiness result as /health/ready', async () => {
    const res = await app.request('/health')

    expect(res.status).toBe(200)
    await expect(decodeResponseBody(HealthReadyResponse, res)).resolves.toEqual({
      dbConnected: true
    })
  })

  it('repeated readiness calls within the cache window keep returning 200', async () => {
    const first = await app.request('/health/ready')
    const second = await app.request('/health/ready')

    expect(first.status).toBe(200)
    expect(second.status).toBe(200)
  })

  it('responds 404 to unsupported methods on health paths', async () => {
    const res = await app.request('/health/live', { method: 'POST' })

    expect(res.status).toBe(404)
  })
})
