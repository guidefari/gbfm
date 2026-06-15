import { beforeAll, describe, expect, it } from 'vitest'
import type { AppType } from '@/app'

let app: AppType

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

beforeAll(async () => {
  const mod = await import('@/app')
  app = mod.default
})

describe('Search API', () => {
  it('GET /search?q=test returns 200 with grouped result arrays', async () => {
    const res = await app.request('/api/search?q=test')
    expect(res.status).toBe(200)
    const body: unknown = await res.json()
    expect(isRecord(body)).toBe(true)
    if (!isRecord(body)) return
    expect(Array.isArray(body.shows)).toBe(true)
    expect(Array.isArray(body.audio)).toBe(true)
    expect(Array.isArray(body.posts)).toBe(true)
  })

  it('GET /search without q returns 422', async () => {
    const res = await app.request('/api/search')
    expect(res.status).toBe(422)
  })
})
