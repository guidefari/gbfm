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

describe('profile (HttpApiBuilder group, Step 6)', () => {
  it('GET /api/profile/:username returns 404 for an unknown username', async () => {
    const res = await webHandler.handler(
      new Request('http://localhost/api/profile/does-not-exist-user')
    )

    expect(res.status).toBe(404)
  })

  it('responds 404 to unsupported methods on the profile path', async () => {
    const res = await webHandler.handler(
      new Request('http://localhost/api/profile/does-not-exist-user', { method: 'POST' })
    )

    expect(res.status).toBe(404)
  })
})

describe('resolve (HttpApiBuilder group, Step 6)', () => {
  it('GET /api/resolve/:slug returns 404 for an unknown slug', async () => {
    const res = await webHandler.handler(
      new Request('http://localhost/api/resolve/does-not-exist-slug')
    )

    expect(res.status).toBe(404)
  })

  it('GET /api/resolve/:slug returns 404 for a reserved slug', async () => {
    const res = await webHandler.handler(new Request('http://localhost/api/resolve/api'))

    expect(res.status).toBe(404)
  })

  it('responds 404 to unsupported methods on the resolve path', async () => {
    const res = await webHandler.handler(
      new Request('http://localhost/api/resolve/does-not-exist-slug', { method: 'POST' })
    )

    expect(res.status).toBe(404)
  })
})

describe('admin (HttpApiBuilder group, Step 6)', () => {
  it('GET /api/admin/overview returns 401 without a session cookie', async () => {
    const res = await webHandler.handler(new Request('http://localhost/api/admin/overview'))

    expect(res.status).toBe(401)
  })

  it('GET /api/admin/newsletter-subscribers returns 401 without a session cookie', async () => {
    const res = await webHandler.handler(
      new Request('http://localhost/api/admin/newsletter-subscribers')
    )

    expect(res.status).toBe(401)
  })

  it('GET /api/admin/frontend-errors/:scenario returns 401 without a session cookie', async () => {
    const res = await webHandler.handler(
      new Request('http://localhost/api/admin/frontend-errors/ok')
    )

    expect(res.status).toBe(401)
  })

  it('GET /api/admin/frontend-errors/:scenario returns 401 (not 400) for an undeclared scenario literal without a session cookie', async () => {
    const res = await webHandler.handler(
      new Request('http://localhost/api/admin/frontend-errors/not-a-real-scenario')
    )

    // AuthMiddleware runs before param schema validation, so an invalid
    // :scenario value still 401s (not 400) when there's no session cookie --
    // confirmed empirically, not assumed from the endpoint declaration order.
    expect(res.status).toBe(401)
  })
})

describe('invite (HttpApiBuilder group, Step 6)', () => {
  it('POST /api/invite/send returns 401 without a session cookie', async () => {
    const res = await webHandler.handler(
      new Request('http://localhost/api/invite/send', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ userId: '00000000-0000-0000-0000-000000000000' })
      })
    )

    expect(res.status).toBe(401)
  })

  it('POST /api/invite/confirm is handled by this group (not the Hono fallback)', async () => {
    const res = await webHandler.handler(
      new Request('http://localhost/api/invite/confirm', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token: 'not-a-real-token', password: 'irrelevant-password' })
      })
    )

    // No auth required (matches the old Hono route). Asserting != 404 rather
    // than a specific status: an unknown token 400s from the handler's own
    // HttpApiError.BadRequest when the DB is reachable, but this suite runs
    // without a live DB in some environments, in which case the verification
    // lookup dies and the group's own error handling turns that into a 500
    // -- either way, a 404 would mean the Hono fallback or better-auth's
    // wildcard matched instead of this endpoint, which is the actual
    // regression this test guards against.
    expect(res.status).not.toBe(404)
  })

  it('POST /api/invite/confirm 400s on a malformed request body regardless of DB state', async () => {
    const res = await webHandler.handler(
      new Request('http://localhost/api/invite/confirm', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ notToken: 'missing required fields' })
      })
    )

    // Schema decode failure short-circuits before any DB call, so this
    // assertion holds even when the DB is unreachable.
    expect(res.status).toBe(400)
  })
})

describe('favorites (HttpApiBuilder group, Step 6)', () => {
  it('GET /api/favorites returns 401 without a session cookie', async () => {
    const res = await webHandler.handler(new Request('http://localhost/api/favorites'))

    expect(res.status).toBe(401)
  })

  it('POST /api/favorites returns 401 without a session cookie', async () => {
    const res = await webHandler.handler(
      new Request('http://localhost/api/favorites', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ audioId: '00000000-0000-0000-0000-000000000000' })
      })
    )

    expect(res.status).toBe(401)
  })

  it('DELETE /api/favorites/:audioId returns 401 without a session cookie', async () => {
    const res = await webHandler.handler(
      new Request('http://localhost/api/favorites/00000000-0000-0000-0000-000000000000', {
        method: 'DELETE'
      })
    )

    expect(res.status).toBe(401)
  })

  it('DELETE /api/favorites/show/:showId returns 401 without a session cookie', async () => {
    const res = await webHandler.handler(
      new Request('http://localhost/api/favorites/show/00000000-0000-0000-0000-000000000000', {
        method: 'DELETE'
      })
    )

    expect(res.status).toBe(401)
  })

  it('DELETE /api/favorites/:audioId returns 401 (not 400) for a non-UUID audioId without a session cookie', async () => {
    const res = await webHandler.handler(
      new Request('http://localhost/api/favorites/not-a-uuid', { method: 'DELETE' })
    )

    // AuthMiddleware runs before param schema validation (same ordering as
    // admin's frontend-errors :scenario case) -- a malformed audioId still
    // 401s rather than 400ing, since there's no session cookie either way.
    expect(res.status).toBe(401)
  })
})

describe('newsletter (HttpApiBuilder group, Step 6)', () => {
  it('POST /api/newsletter/unsubscribe returns 404 for an unknown token', async () => {
    const res = await webHandler.handler(
      new Request('http://localhost/api/newsletter/unsubscribe', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token: '00000000-0000-0000-0000-000000000000' })
      })
    )

    expect(res.status).toBe(404)
  })

  it('POST /api/newsletter/subscribe 400s on a malformed request body', async () => {
    const res = await webHandler.handler(
      new Request('http://localhost/api/newsletter/subscribe', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ notEmail: 'missing required field' })
      })
    )

    expect(res.status).toBe(400)
  })

  it('POST /api/newsletter/request-unsubscribe returns 200 even for an unknown email (no enumeration signal)', async () => {
    const res = await webHandler.handler(
      new Request('http://localhost/api/newsletter/request-unsubscribe', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'definitely-not-a-real-subscriber@example.com' })
      })
    )

    // Matches the old handler: always 200 with { sent: true } regardless of
    // whether the email is on the list, so this endpoint can't be used to
    // enumerate subscribers.
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ sent: true })
  })

  it('responds 404 to unsupported methods on the newsletter subscribe path', async () => {
    const res = await webHandler.handler(
      new Request('http://localhost/api/newsletter/subscribe', { method: 'GET' })
    )

    expect(res.status).toBe(404)
  })

  it('POST /api/newsletter/subscribe 400s on an invalid email format', async () => {
    const res = await webHandler.handler(
      new Request('http://localhost/api/newsletter/subscribe', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'not-an-email' })
      })
    )

    expect(res.status).toBe(400)
  })

  it('POST /api/newsletter/unsubscribe 400s on a non-UUID token', async () => {
    const res = await webHandler.handler(
      new Request('http://localhost/api/newsletter/unsubscribe', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token: 'not-a-uuid' })
      })
    )

    expect(res.status).toBe(400)
  })
})

describe('file-manager (HttpApiBuilder group, Step 6)', () => {
  it('GET /api/file-manager/config returns 401 without a session cookie', async () => {
    const res = await webHandler.handler(new Request('http://localhost/api/file-manager/config'))

    expect(res.status).toBe(401)
  })

  it('GET /api/file-manager/list returns 401 without a session cookie', async () => {
    const res = await webHandler.handler(
      new Request('http://localhost/api/file-manager/list?bucketName=test-bucket')
    )

    expect(res.status).toBe(401)
  })

  it('POST /api/file-manager/copy returns 401 without a session cookie', async () => {
    const res = await webHandler.handler(
      new Request('http://localhost/api/file-manager/copy', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          key: 'some-key',
          sourceBucket: 'a',
          destinationBucket: 'b'
        })
      })
    )

    expect(res.status).toBe(401)
  })

  it('POST /api/file-manager/copy returns 401 (not 400) for an empty key without a session cookie', async () => {
    const res = await webHandler.handler(
      new Request('http://localhost/api/file-manager/copy', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ key: '', sourceBucket: 'a', destinationBucket: 'b' })
      })
    )

    // AuthMiddleware runs before payload schema validation, so an empty
    // (Schema.NonEmptyString-violating) key still 401s rather than 400ing
    // when there's no session cookie -- same ordering as admin/favorites.
    expect(res.status).toBe(401)
  })
})

describe('spotify (HttpApiBuilder group, Step 6)', () => {
  it('POST /api/spotify/track 400s on an empty id (no auth required, unlike other groups)', async () => {
    const res = await webHandler.handler(
      new Request('http://localhost/api/spotify/track', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: '' })
      })
    )

    expect(res.status).toBe(400)
  })

  it('POST /api/spotify/search/albums 400s on an empty query', async () => {
    const res = await webHandler.handler(
      new Request('http://localhost/api/spotify/search/albums', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query: '' })
      })
    )

    expect(res.status).toBe(400)
  })

  it('POST /api/spotify/search/albums 400s on limit above the 50 max', async () => {
    const res = await webHandler.handler(
      new Request('http://localhost/api/spotify/search/albums', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query: 'test', limit: 999 })
      })
    )

    expect(res.status).toBe(400)
  })

  it('POST /api/spotify/enrich 400s on a non-URL string', async () => {
    const res = await webHandler.handler(
      new Request('http://localhost/api/spotify/enrich', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url: 'not-a-url' })
      })
    )

    expect(res.status).toBe(400)
  })

  it('POST /api/spotify/track with a real-shaped id returns a real status (not 401 -- unauthenticated is fine for this group)', async () => {
    const res = await webHandler.handler(
      new Request('http://localhost/api/spotify/track', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: 'not-a-real-spotify-id' })
      })
    )

    // No AuthMiddleware on this group (matches the old Hono routes, which
    // had no betterAuthMiddleware). An invalid-but-nonempty Spotify ID
    // reaches SpotifyService, which fails with statusCode 400 -- this is
    // the specific bug fix this PR makes (the old handler's generic error
    // mapper hard-coded every SpotifyError to 502 regardless of the
    // service's own statusCode).
    expect(res.status).not.toBe(401)
    expect(res.status).not.toBe(502)
  })
})

describe('shows (HttpApiBuilder group, Step 6)', () => {
  it('GET /api/shows works without a session cookie (optional auth, matches old attachSessionContext)', async () => {
    const res = await webHandler.handler(new Request('http://localhost/api/shows'))

    // Not 401 -- getAllShows never requires auth, it only uses a session
    // (if present) to decide whether to include drafts. A DB-connectivity
    // 500 in this environment is still evidence the request wasn't
    // rejected for lacking a cookie.
    expect(res.status).not.toBe(401)
  })

  it('GET /api/shows/:slug returns something other than 401 without a session cookie', async () => {
    const res = await webHandler.handler(
      new Request('http://localhost/api/shows/does-not-exist-slug')
    )

    expect(res.status).not.toBe(401)
  })

  it('GET /api/shows?limit=999 400s (limit above the 100 max)', async () => {
    const res = await webHandler.handler(new Request('http://localhost/api/shows?limit=999'))

    expect(res.status).toBe(400)
  })

  it('POST /api/shows returns 401 without a session cookie', async () => {
    const res = await webHandler.handler(
      new Request('http://localhost/api/shows', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: 'Test Show', slug: 'test-show', content: 'hello' })
      })
    )

    expect(res.status).toBe(401)
  })

  it('PATCH /api/shows/:slug returns 401 without a session cookie', async () => {
    const res = await webHandler.handler(
      new Request('http://localhost/api/shows/some-slug', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: 'Renamed' })
      })
    )

    expect(res.status).toBe(401)
  })

  it('DELETE /api/shows/:slug returns 401 without a session cookie', async () => {
    const res = await webHandler.handler(
      new Request('http://localhost/api/shows/some-slug', { method: 'DELETE' })
    )

    expect(res.status).toBe(401)
  })

  it('POST /api/shows/:id/subscribe returns 401 without a session cookie', async () => {
    const res = await webHandler.handler(
      new Request('http://localhost/api/shows/00000000-0000-0000-0000-000000000000/subscribe', {
        method: 'POST'
      })
    )

    expect(res.status).toBe(401)
  })

  it('DELETE /api/shows/:id/unsubscribe returns 401 without a session cookie', async () => {
    const res = await webHandler.handler(
      new Request('http://localhost/api/shows/00000000-0000-0000-0000-000000000000/unsubscribe', {
        method: 'DELETE'
      })
    )

    expect(res.status).toBe(401)
  })

  it('GET /api/shows/:slug/episodes returns something other than 401 without a session cookie', async () => {
    const res = await webHandler.handler(
      new Request('http://localhost/api/shows/does-not-exist-slug/episodes')
    )

    expect(res.status).not.toBe(401)
  })

  it('GET /api/shows/:slug/qr-pdf returns something other than 401 without a session cookie', async () => {
    const res = await webHandler.handler(
      new Request('http://localhost/api/shows/does-not-exist-slug/qr-pdf')
    )

    expect(res.status).not.toBe(401)
  })
})
