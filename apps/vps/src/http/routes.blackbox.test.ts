import { HealthLiveResponse, HealthReadyResponse } from '@gbfm/api/health'
import { ArtistListResponse } from '@gbfm/api/music'
import { SearchResults } from '@gbfm/api/search'
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
  it('GET /api/music/albums returns the same response as the plain Hono app', async () => {
    const [viaHandler, viaHono] = await Promise.all([
      webHandler.handler(new Request('http://localhost/api/music/albums')),
      app.request('/api/music/albums')
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

describe('music artists (HttpApiBuilder group, Step 4)', () => {
  it('GET /api/music/artists returns 200 with a decodable list', async () => {
    const res = await webHandler.handler(new Request('http://localhost/api/music/artists'))

    expect(res.status).toBe(200)
    await expect(decodeResponseBody(ArtistListResponse, res)).resolves.toBeInstanceOf(Array)
  })

  it('GET /api/music/artists/:id returns 404 for an unknown id', async () => {
    const res = await webHandler.handler(
      new Request('http://localhost/api/music/artists/00000000-0000-0000-0000-000000000000')
    )

    expect(res.status).toBe(404)
  })

  it('POST /api/music/artists returns 401 without a session cookie', async () => {
    const res = await webHandler.handler(
      new Request('http://localhost/api/music/artists', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'Test Artist', slug: 'test-artist' })
      })
    )

    expect(res.status).toBe(401)
  })

  it('PATCH /api/music/artists/:id returns 401 without a session cookie', async () => {
    const res = await webHandler.handler(
      new Request('http://localhost/api/music/artists/00000000-0000-0000-0000-000000000000', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'Renamed' })
      })
    )

    expect(res.status).toBe(401)
  })

  it('DELETE /api/music/artists/:id returns 401 without a session cookie', async () => {
    const res = await webHandler.handler(
      new Request('http://localhost/api/music/artists/00000000-0000-0000-0000-000000000000', {
        method: 'DELETE'
      })
    )

    expect(res.status).toBe(401)
  })

  it('PUT /api/music/albums/:albumId/artists/:artistId returns 401 without a session cookie', async () => {
    const res = await webHandler.handler(
      new Request(
        'http://localhost/api/music/albums/00000000-0000-0000-0000-000000000000/artists/00000000-0000-0000-0000-000000000000',
        { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({}) }
      )
    )

    expect(res.status).toBe(401)
  })
})

describe('search (HttpApiBuilder group, Step 6)', () => {
  it('GET /api/search?q=test returns 200 with a decodable grouped result', async () => {
    const res = await webHandler.handler(new Request('http://localhost/api/search?q=test'))

    expect(res.status).toBe(200)
    // A successful decode against SearchResults already proves shows/audio/posts
    // exist and are arrays -- asserting field-by-field on top of that would just
    // re-check what decode already guarantees.
    await expect(decodeResponseBody(SearchResults, res)).resolves.toBeTruthy()
  })

  it('GET /api/search?q=test sets a public Cache-Control header', async () => {
    const res = await webHandler.handler(new Request('http://localhost/api/search?q=test'))

    expect(res.headers.get('cache-control')).toBe('public, max-age=60, stale-while-revalidate=300')
  })

  it('GET /api/search without q returns 400 (query validation failure)', async () => {
    const res = await webHandler.handler(new Request('http://localhost/api/search'))

    expect(res.status).toBe(400)
  })

  it('GET /api/search?q=test&limit=999 returns 400 (limit above the 50 max)', async () => {
    const res = await webHandler.handler(
      new Request('http://localhost/api/search?q=test&limit=999')
    )

    expect(res.status).toBe(400)
  })

  it('other paths do not get the search Cache-Control header', async () => {
    const res = await webHandler.handler(new Request('http://localhost/health/live'))

    expect(res.headers.get('cache-control')).toBeNull()
  })
})
