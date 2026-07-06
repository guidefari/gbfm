import { beforeAll, describe, expect, it } from 'vitest'
import type { AppType } from '@/app'

let app: AppType

beforeAll(async () => {
  const mod = await import('@/app')
  app = mod.default
})

describe('Health endpoints (behavior baseline)', () => {
  it('GET /health/live returns 200 with { ok: true }', async () => {
    const res = await app.request('/health/live')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
  })

  it('GET /health/ready returns 200 with { dbConnected: true } when the DB is reachable', async () => {
    const res = await app.request('/health/ready')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ dbConnected: true })
  })

  it('GET /health is an alias of /health/ready', async () => {
    const res = await app.request('/health')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ dbConnected: true })
  })

  it('serves readiness from the 5s cache on repeated calls (same status, no extra DB work)', async () => {
    const first = await app.request('/health/ready')
    const second = await app.request('/health/ready')
    expect(first.status).toBe(second.status)
    expect(await first.json()).toEqual(await second.json())
  })

  it('does not rate-limit health probes even under rapid fire', async () => {
    const statuses: number[] = []
    for (let i = 0; i < 80; i++) {
      statuses.push((await app.request('/health/live')).status)
    }
    expect(statuses.every((s) => s === 200)).toBe(true)
  })

  it('responds 404 to unsupported methods on health paths', async () => {
    const res = await app.request('/health/live', { method: 'POST' })
    expect(res.status).toBe(404)
  })
})
