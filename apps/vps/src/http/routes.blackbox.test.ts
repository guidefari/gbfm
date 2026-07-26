import { HealthLiveResponse, HealthReadyResponse } from '@gbfm/api/health'
import {
  AlbumListResponse,
  ArtistListResponse,
  LabelListResponse,
  PlaylistListResponse,
  TrackListResponse
} from '@gbfm/api/music'
import { SearchResults } from '@gbfm/api/search'
import { decodeResponseBody } from '@gbfm/api/testing'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { db } from '@/db'
import { audioTable } from '@/db/audio.schema'
import { session, user } from '@/db/auth.schema'
import { musicLabelCreatorsTable, musicLabelsTable } from '@/db/music-entity.schema'
import { postCreators, postsTable } from '@/db/post.schema'
import { releasesTable } from '@/db/release.schema'
import { showsTable } from '@/db/show.schema'
import { createWebHandler } from './routes'

// Blackbox suite asserting only the wire contract, so these assertions keep
// working as more groups move from the Hono fallback onto the Effect router
// (docs/migration-effect-http-api.md).
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

describe('Effect router (Step 8: HonoFallback removed)', () => {
  it('GET /api/music/artists is served directly by the HttpApi group (no Hono app in the request path)', async () => {
    const res = await webHandler.handler(new Request('http://localhost/api/music/artists'))

    expect(res.status).toBe(200)
    await expect(decodeResponseBody(ArtistListResponse, res)).resolves.toBeTruthy()
  })

  it('unknown routes 404 via Effect HttpRouter.RouteNotFound (empty body -- no Hono notFound JSON, no fallback to serve)', async () => {
    const res = await webHandler.handler(new Request('http://localhost/does-not-exist'))

    expect(res.status).toBe(404)
    expect(await res.text()).toBe('')
  })
})

describe('better-auth route (Step 2c)', () => {
  it('GET /auth/get-session is handled by the auth route', async () => {
    const res = await webHandler.handler(new Request('http://localhost/auth/get-session'))

    // better-auth's own response for an unauthenticated session check, not a
    // RouteNotFound 404 -- proves /auth/* is matched ahead of everything else.
    expect(res.status).toBe(200)
    expect(await res.json()).toBeNull()
  })

  it("unknown /auth/* paths are handled by better-auth, not Effect's own RouteNotFound", async () => {
    const withoutAuth = await webHandler.handler(new Request('http://localhost/does-not-exist'))
    const withAuth = await webHandler.handler(new Request('http://localhost/auth/does-not-exist'))

    expect(withoutAuth.status).toBe(404)
    expect(withAuth.status).toBe(404)
    // Both are empty-bodied 404s (Effect's own RouteNotFound and better-auth's
    // internal 404 are both content-length: 0), so the body can't
    // discriminate them. Rate-limit headers can: RateLimiterLive only sees a
    // request that reached a matched route's httpEffect -- a bare
    // RouteNotFound failure short-circuits before the route ever resolves,
    // so it carries no x-ratelimit-* headers, while /auth/*'s wildcard route
    // did match (better-auth's own handler produced the 404), so it does.
    expect(withoutAuth.headers.has('x-ratelimit-limit')).toBe(false)
    expect(withAuth.headers.has('x-ratelimit-limit')).toBe(true)
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

describe('music labels', () => {
  it('returns a decodable public label list', async () => {
    const res = await webHandler.handler(new Request('http://localhost/api/music/labels'))

    expect(res.status).toBe(200)
    await expect(decodeResponseBody(LabelListResponse, res)).resolves.toBeInstanceOf(Array)
  })

  it('returns 404 for an unknown public label slug', async () => {
    const res = await webHandler.handler(
      new Request('http://localhost/api/music/labels/slug/unknown-label')
    )

    expect(res.status).toBe(404)
  })

  it('requires authentication for managed labels', async () => {
    const res = await webHandler.handler(new Request('http://localhost/api/music/labels/manage'))

    expect(res.status).toBe(401)
  })
})

// Regression test for the gap documented in docs/migration-effect-http-api.md
// and docs/migration-effect-http-api-process.md: commit d052ce82 ("port
// search to HttpApiBuilder.group, Step 6") deleted the entire routes/music/*
// Hono directory -- including fully-implemented album/track/playlist/
// entity-link handlers -- claiming (incorrectly) they were dead code already
// superseded by http/music.handlers.ts. That left /api/music/albums and
// friends 404ing in production. This block proves the port is real.
describe('music albums/tracks/playlists (HttpApiBuilder group, Step 6c)', () => {
  it('GET /api/music/albums returns 200 with a decodable list', async () => {
    const res = await webHandler.handler(new Request('http://localhost/api/music/albums'))

    expect(res.status).toBe(200)
    await expect(decodeResponseBody(AlbumListResponse, res)).resolves.toBeInstanceOf(Array)
  })

  it('GET /api/music/albums/:id returns 404 for an unknown id', async () => {
    const res = await webHandler.handler(
      new Request('http://localhost/api/music/albums/00000000-0000-0000-0000-000000000000')
    )

    expect(res.status).toBe(404)
  })

  it('POST /api/music/albums returns 401 without a session cookie', async () => {
    const res = await webHandler.handler(
      new Request('http://localhost/api/music/albums', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: 'Test Album', slug: 'test-album' })
      })
    )

    expect(res.status).toBe(401)
  })

  it('PATCH /api/music/albums/:id returns 401 without a session cookie', async () => {
    const res = await webHandler.handler(
      new Request('http://localhost/api/music/albums/00000000-0000-0000-0000-000000000000', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: 'Renamed' })
      })
    )

    expect(res.status).toBe(401)
  })

  it('DELETE /api/music/albums/:id returns 401 without a session cookie', async () => {
    const res = await webHandler.handler(
      new Request('http://localhost/api/music/albums/00000000-0000-0000-0000-000000000000', {
        method: 'DELETE'
      })
    )

    expect(res.status).toBe(401)
  })

  it('GET /api/music/tracks returns 200 with a decodable list', async () => {
    const res = await webHandler.handler(new Request('http://localhost/api/music/tracks'))

    expect(res.status).toBe(200)
    await expect(decodeResponseBody(TrackListResponse, res)).resolves.toBeInstanceOf(Array)
  })

  it('GET /api/music/tracks/:id returns 404 for an unknown id', async () => {
    const res = await webHandler.handler(
      new Request('http://localhost/api/music/tracks/00000000-0000-0000-0000-000000000000')
    )

    expect(res.status).toBe(404)
  })

  it('POST /api/music/tracks returns 401 without a session cookie', async () => {
    const res = await webHandler.handler(
      new Request('http://localhost/api/music/tracks', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: 'Test Track', slug: 'test-track' })
      })
    )

    expect(res.status).toBe(401)
  })

  it('DELETE /api/music/tracks/:id returns 401 without a session cookie', async () => {
    const res = await webHandler.handler(
      new Request('http://localhost/api/music/tracks/00000000-0000-0000-0000-000000000000', {
        method: 'DELETE'
      })
    )

    expect(res.status).toBe(401)
  })

  it('GET /api/music/playlists returns 200 with a decodable list', async () => {
    const res = await webHandler.handler(new Request('http://localhost/api/music/playlists'))

    expect(res.status).toBe(200)
    await expect(decodeResponseBody(PlaylistListResponse, res)).resolves.toBeInstanceOf(Array)
  })

  it('GET /api/music/playlists/:id returns 404 for an unknown id', async () => {
    const res = await webHandler.handler(
      new Request('http://localhost/api/music/playlists/00000000-0000-0000-0000-000000000000')
    )

    expect(res.status).toBe(404)
  })

  it('GET /api/music/playlists/:id/tracks returns 401-free 200 (public read) with an empty list for an unknown playlist', async () => {
    const res = await webHandler.handler(
      new Request(
        'http://localhost/api/music/playlists/00000000-0000-0000-0000-000000000000/tracks'
      )
    )

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual([])
  })

  it('POST /api/music/playlists/:id/tracks returns 401 without a session cookie', async () => {
    const res = await webHandler.handler(
      new Request(
        'http://localhost/api/music/playlists/00000000-0000-0000-0000-000000000000/tracks',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ trackId: '00000000-0000-0000-0000-000000000000', position: 0 })
        }
      )
    )

    expect(res.status).toBe(401)
  })

  it('PUT /api/music/playlists/:id/tracks/order returns 401 without a session cookie', async () => {
    const res = await webHandler.handler(
      new Request(
        'http://localhost/api/music/playlists/00000000-0000-0000-0000-000000000000/tracks/order',
        {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ trackIds: ['00000000-0000-0000-0000-000000000000'] })
        }
      )
    )

    expect(res.status).toBe(401)
  })

  it('POST /api/music/playlists/import/spotify returns 401 without a session cookie', async () => {
    const res = await webHandler.handler(
      new Request('http://localhost/api/music/playlists/import/spotify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url: 'https://open.spotify.com/playlist/abc' })
      })
    )

    expect(res.status).toBe(401)
  })
})

describe('music entity-links/resolve/scrape (HttpApiBuilder group, Step 6d)', () => {
  it('GET /api/music/artist/:id/links returns 200 with a decodable (empty) list for an unknown entity', async () => {
    const res = await webHandler.handler(
      new Request('http://localhost/api/music/artist/00000000-0000-0000-0000-000000000000/links')
    )

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual([])
  })

  it('GET /api/music/:entityType/:entityId/links 400s for an invalid entityType (schema-level rejection)', async () => {
    const res = await webHandler.handler(
      new Request(
        'http://localhost/api/music/not-a-real-type/00000000-0000-0000-0000-000000000000/links'
      )
    )

    expect(res.status).toBe(400)
  })

  it('POST /api/music/artist/:id/links returns 401 without a session cookie', async () => {
    const res = await webHandler.handler(
      new Request('http://localhost/api/music/artist/00000000-0000-0000-0000-000000000000/links', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ platform: 'spotify', url: 'https://open.spotify.com/artist/x' })
      })
    )

    expect(res.status).toBe(401)
  })

  it('PATCH /api/music/artist/:id/links/:linkId returns 401 without a session cookie', async () => {
    const res = await webHandler.handler(
      new Request(
        'http://localhost/api/music/artist/00000000-0000-0000-0000-000000000000/links/00000000-0000-0000-0000-000000000000',
        {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ status: 'verified' })
        }
      )
    )

    expect(res.status).toBe(401)
  })

  it('DELETE /api/music/artist/:id/links/:linkId returns 401 without a session cookie', async () => {
    const res = await webHandler.handler(
      new Request(
        'http://localhost/api/music/artist/00000000-0000-0000-0000-000000000000/links/00000000-0000-0000-0000-000000000000',
        { method: 'DELETE' }
      )
    )

    expect(res.status).toBe(401)
  })

  it('POST /api/music/resolve returns 401 without a session cookie', async () => {
    const res = await webHandler.handler(
      new Request('http://localhost/api/music/resolve', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url: 'https://open.spotify.com/track/abc' })
      })
    )

    expect(res.status).toBe(401)
  })

  it('POST /api/music/resolve returns 401 (not 400) for a non-URL body without a session -- AuthMiddleware runs before payload schema validation', async () => {
    const res = await webHandler.handler(
      new Request('http://localhost/api/music/resolve', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url: 'not-a-url' })
      })
    )

    expect(res.status).toBe(401)
  })

  it('POST /api/music/artist/scrape returns 401 without a session cookie', async () => {
    const res = await webHandler.handler(
      new Request('http://localhost/api/music/artist/scrape', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ artistName: 'Test Artist' })
      })
    )

    expect(res.status).toBe(401)
  })

  it('GET /api/music/links/pending returns 401 without a session cookie', async () => {
    const res = await webHandler.handler(new Request('http://localhost/api/music/links/pending'))

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

describe('email (HttpApiBuilder group, Step 6)', () => {
  it('GET /api/email/logs returns 401 without a session cookie', async () => {
    const res = await webHandler.handler(new Request('http://localhost/api/email/logs'))

    expect(res.status).toBe(401)
  })

  it('POST /api/email/send-mix-notification returns 401 without a session cookie', async () => {
    const res = await webHandler.handler(
      new Request('http://localhost/api/email/send-mix-notification', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ mixSlug: 'test-mix' })
      })
    )

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

describe('music-reminders (HttpApiBuilder group, Step 6)', () => {
  it('GET /api/music-reminders returns 401 without a session cookie', async () => {
    const res = await webHandler.handler(new Request('http://localhost/api/music-reminders'))

    expect(res.status).toBe(401)
  })

  it('POST /api/music-reminders returns 401 without a session cookie', async () => {
    const res = await webHandler.handler(
      new Request('http://localhost/api/music-reminders', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          musicTitle: 'Test Song',
          artistName: 'Test Artist',
          musicUrl: 'https://example.com/track',
          reminderDate: '2030-01-01T00:00:00Z'
        })
      })
    )

    expect(res.status).toBe(401)
  })

  it('PUT /api/music-reminders/:id returns 401 without a session cookie', async () => {
    const res = await webHandler.handler(
      new Request('http://localhost/api/music-reminders/00000000-0000-0000-0000-000000000000', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ musicTitle: 'Updated' })
      })
    )

    expect(res.status).toBe(401)
  })

  it('DELETE /api/music-reminders/:id returns 401 without a session cookie', async () => {
    const res = await webHandler.handler(
      new Request('http://localhost/api/music-reminders/00000000-0000-0000-0000-000000000000', {
        method: 'DELETE'
      })
    )

    expect(res.status).toBe(401)
  })

  it('DELETE /api/music-reminders/:id returns 401 (not 400) for a non-UUID id without a session cookie', async () => {
    const res = await webHandler.handler(
      new Request('http://localhost/api/music-reminders/not-a-uuid', { method: 'DELETE' })
    )

    // AuthMiddleware runs before param schema validation (same ordering as
    // favorites' non-UUID case above) -- a malformed id still 401s rather
    // than 400ing, since there's no session cookie either way.
    expect(res.status).toBe(401)
  })
})

describe('upload (HttpApiBuilder group, Step 7)', () => {
  // uploadFile has never required a session -- the old Hono route had no
  // betterAuthMiddleware, and no real apps/www caller sends
  // credentials: 'include' to it (see packages/api/src/upload.ts's comment).
  it('POST /api/upload/file returns 400 (not 401) for a request with no file', async () => {
    const formData = new FormData()
    formData.append('fileType', 'image')

    const res = await webHandler.handler(
      new Request('http://localhost/api/upload/file', { method: 'POST', body: formData })
    )

    expect(res.status).toBe(400)
  })

  it('POST /api/upload/multipart/init returns 401 without a session cookie', async () => {
    const res = await webHandler.handler(
      new Request('http://localhost/api/upload/multipart/init', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          fileName: 'test.mp3',
          contentType: 'audio/mpeg',
          fileSize: 1024,
          fileType: 'audio'
        })
      })
    )

    expect(res.status).toBe(401)
  })

  it('POST /api/upload/multipart/presign-part returns 401 without a session cookie', async () => {
    const res = await webHandler.handler(
      new Request('http://localhost/api/upload/multipart/presign-part', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          key: 'user123/audio_1_test.mp3',
          uploadId: 'upload-id',
          partNumber: 1
        })
      })
    )

    expect(res.status).toBe(401)
  })

  it('POST /api/upload/multipart/complete returns 401 without a session cookie', async () => {
    const res = await webHandler.handler(
      new Request('http://localhost/api/upload/multipart/complete', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          key: 'user123/audio_1_test.mp3',
          uploadId: 'upload-id',
          parts: [{ partNumber: 1, etag: 'etag1' }]
        })
      })
    )

    expect(res.status).toBe(401)
  })

  it('POST /api/upload/multipart/abort returns 401 without a session cookie', async () => {
    const res = await webHandler.handler(
      new Request('http://localhost/api/upload/multipart/abort', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ key: 'user123/audio_1_test.mp3', uploadId: 'upload-id' })
      })
    )

    expect(res.status).toBe(401)
  })

  it('GET /api/upload/multipart/status returns 401 without a session cookie', async () => {
    const res = await webHandler.handler(
      new Request(
        'http://localhost/api/upload/multipart/status?key=user123%2Faudio_1_test.mp3&uploadId=upload-id'
      )
    )

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

  it('POST /api/shows/:id/subscribe returns 401 (not 400) for a non-UUID id without a session cookie', async () => {
    const res = await webHandler.handler(
      new Request('http://localhost/api/shows/not-a-uuid/subscribe', { method: 'POST' })
    )

    // AuthMiddleware runs before param schema validation, same ordering as
    // admin/favorites/file-manager.
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

describe('content draft management authorization', () => {
  it('keeps draft posts publicly hidden while allowing only their creator and admins to manage them', async () => {
    const suffix = crypto.randomUUID()
    const ownerId = `post-owner-${suffix}`
    const unrelatedId = `post-unrelated-${suffix}`
    const adminId = `post-admin-${suffix}`
    const ownerToken = `post-owner-token-${suffix}`
    const unrelatedToken = `post-unrelated-token-${suffix}`
    const adminToken = `post-admin-token-${suffix}`
    const slug = `managed-draft-${suffix}`

    await db.insert(user).values([
      { id: ownerId, name: 'Post owner', email: `${ownerId}@example.com` },
      { id: unrelatedId, name: 'Unrelated user', email: `${unrelatedId}@example.com` },
      { id: adminId, name: 'Admin user', email: `${adminId}@example.com`, role: 'admin' }
    ])
    await db.insert(session).values([
      {
        id: crypto.randomUUID(),
        token: ownerToken,
        userId: ownerId,
        expiresAt: new Date(Date.now() + 60_000)
      },
      {
        id: crypto.randomUUID(),
        token: unrelatedToken,
        userId: unrelatedId,
        expiresAt: new Date(Date.now() + 60_000)
      },
      {
        id: crypto.randomUUID(),
        token: adminToken,
        userId: adminId,
        expiresAt: new Date(Date.now() + 60_000)
      }
    ])
    const [post] = await db
      .insert(postsTable)
      .values({ title: 'Managed draft', slug, content: 'draft', type: 'post', draft: true })
      .returning()
    if (!post) throw new Error('Failed to seed managed draft post')
    await db.insert(postCreators).values({ postId: post.id, creatorId: ownerId })

    const authenticatedRequest = (url: string, token: string) =>
      new Request(url, { headers: { authorization: `Bearer ${token}` } })

    try {
      const [publicDetail, publicList, ownerDetail, adminDetail, unrelatedDetail, ownerList] =
        await Promise.all([
          webHandler.handler(new Request(`http://localhost/api/content/posts/${slug}`)),
          webHandler.handler(new Request('http://localhost/api/content/posts?limit=100')),
          webHandler.handler(
            authenticatedRequest(`http://localhost/api/content/posts/${slug}/edit`, ownerToken)
          ),
          webHandler.handler(
            authenticatedRequest(`http://localhost/api/content/posts/${slug}/edit`, adminToken)
          ),
          webHandler.handler(
            authenticatedRequest(`http://localhost/api/content/posts/${slug}/edit`, unrelatedToken)
          ),
          webHandler.handler(
            authenticatedRequest(
              'http://localhost/api/content/posts/manage?type=post&limit=100',
              ownerToken
            )
          )
        ])

      expect(publicDetail.status).toBe(404)
      expect(JSON.stringify(await publicList.json())).not.toContain(slug)
      expect(ownerDetail.status).toBe(200)
      expect(adminDetail.status).toBe(200)
      expect(unrelatedDetail.status).toBe(401)
      expect(JSON.stringify(await ownerList.json())).toContain(slug)
    } finally {
      await db.delete(postCreators).where(eq(postCreators.postId, post.id))
      await db.delete(postsTable).where(eq(postsTable.id, post.id))
      await db.delete(user).where(eq(user.id, ownerId))
      await db.delete(user).where(eq(user.id, unrelatedId))
      await db.delete(user).where(eq(user.id, adminId))
    }
  })

  it('allows release mutations only to the owning label creator or an admin', async () => {
    const suffix = crypto.randomUUID()
    const ownerId = `release-owner-${suffix}`
    const unrelatedId = `release-unrelated-${suffix}`
    const adminId = `release-admin-${suffix}`
    const ownerToken = `release-owner-token-${suffix}`
    const unrelatedToken = `release-unrelated-token-${suffix}`
    const adminToken = `release-admin-token-${suffix}`
    const labelSlug = `release-label-${suffix}`

    await db.insert(user).values([
      { id: ownerId, name: 'Release owner', email: `${ownerId}@example.com` },
      { id: unrelatedId, name: 'Unrelated user', email: `${unrelatedId}@example.com` },
      { id: adminId, name: 'Admin user', email: `${adminId}@example.com`, role: 'admin' }
    ])
    await db.insert(session).values([
      {
        id: crypto.randomUUID(),
        token: ownerToken,
        userId: ownerId,
        expiresAt: new Date(Date.now() + 60_000)
      },
      {
        id: crypto.randomUUID(),
        token: unrelatedToken,
        userId: unrelatedId,
        expiresAt: new Date(Date.now() + 60_000)
      },
      {
        id: crypto.randomUUID(),
        token: adminToken,
        userId: adminId,
        expiresAt: new Date(Date.now() + 60_000)
      }
    ])
    const [label] = await db
      .insert(musicLabelsTable)
      .values({ name: 'Release label', slug: labelSlug, content: '' })
      .returning()
    if (!label) throw new Error('Failed to seed release label')
    await db.insert(musicLabelCreatorsTable).values({ labelId: label.id, creatorId: ownerId })

    const createRequest = (token: string, slug: string) =>
      new Request('http://localhost/api/content/releases', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          title: slug,
          slug,
          content: '',
          draft: true,
          labelId: label.id,
          releaseDate: new Date().toISOString()
        })
      })

    try {
      const ownerSlug = `owner-release-${suffix}`
      const adminSlug = `admin-release-${suffix}`
      const deniedSlug = `denied-release-${suffix}`
      const [ownerCreate, adminCreate, unrelatedCreate] = await Promise.all([
        webHandler.handler(createRequest(ownerToken, ownerSlug)),
        webHandler.handler(createRequest(adminToken, adminSlug)),
        webHandler.handler(createRequest(unrelatedToken, deniedSlug))
      ])

      expect(ownerCreate.status).toBe(200)
      expect(adminCreate.status).toBe(200)
      expect(unrelatedCreate.status).toBe(401)

      const updateRequest = (token: string, slug: string, title: string) =>
        new Request(`http://localhost/api/content/releases/${slug}`, {
          method: 'PATCH',
          headers: {
            authorization: `Bearer ${token}`,
            'content-type': 'application/json'
          },
          body: JSON.stringify({ title })
        })
      const [ownerUpdate, adminUpdate, unrelatedUpdate] = await Promise.all([
        webHandler.handler(updateRequest(ownerToken, ownerSlug, 'Owner updated')),
        webHandler.handler(updateRequest(adminToken, adminSlug, 'Admin updated')),
        webHandler.handler(updateRequest(unrelatedToken, ownerSlug, 'Denied update'))
      ])

      expect(ownerUpdate.status).toBe(200)
      expect(adminUpdate.status).toBe(200)
      expect(unrelatedUpdate.status).toBe(401)

      const deniedDelete = await webHandler.handler(
        new Request(`http://localhost/api/content/releases/${ownerSlug}`, {
          method: 'DELETE',
          headers: { authorization: `Bearer ${unrelatedToken}` }
        })
      )
      const adminDelete = await webHandler.handler(
        new Request(`http://localhost/api/content/releases/${adminSlug}`, {
          method: 'DELETE',
          headers: { authorization: `Bearer ${adminToken}` }
        })
      )
      expect(deniedDelete.status).toBe(401)
      expect(adminDelete.status).toBe(200)
    } finally {
      await db.delete(releasesTable).where(eq(releasesTable.labelId, label.id))
      await db.delete(musicLabelCreatorsTable).where(eq(musicLabelCreatorsTable.labelId, label.id))
      await db.delete(musicLabelsTable).where(eq(musicLabelsTable.id, label.id))
      await db.delete(user).where(eq(user.id, ownerId))
      await db.delete(user).where(eq(user.id, unrelatedId))
      await db.delete(user).where(eq(user.id, adminId))
    }
  })
})

describe('site routes (plain HttpRouter, Step 7)', () => {
  it('keeps drafts out of canonical API, share, tag, episode, and RSS surfaces', async () => {
    const suffix = crypto.randomUUID()
    const slug = `draft-${suffix}`
    const tag = `draft-tag-${suffix}`
    const [publishedShow] = await db
      .insert(showsTable)
      .values({ title: 'Published parent', slug: `published-${suffix}`, content: '', draft: false })
      .returning()
    const [publishedLabel] = await db
      .insert(musicLabelsTable)
      .values({
        name: 'Published parent',
        slug: `published-${suffix}`,
        content: '',
        publishedAt: new Date()
      })
      .returning()

    if (!publishedShow || !publishedLabel) throw new Error('Failed to seed draft visibility test')

    await Promise.all([
      db.insert(audioTable).values({
        title: 'Draft audio',
        slug,
        content: '',
        type: 'mix',
        url: 'https://example.com/draft.mp3',
        draft: true,
        tags: [tag]
      }),
      db.insert(audioTable).values({
        title: 'Draft episode',
        slug: `episode-${suffix}`,
        content: '',
        type: 'mix',
        url: 'https://example.com/episode.mp3',
        showId: publishedShow.id,
        draft: true
      }),
      db.insert(showsTable).values({ title: 'Draft show', slug, content: '', draft: true }),
      db.insert(postsTable).values({
        title: 'Draft post',
        slug,
        content: 'draft',
        type: 'post',
        draft: true,
        tags: [tag]
      }),
      db.insert(musicLabelsTable).values({ name: 'Draft label', slug, content: '' }),
      db.insert(releasesTable).values({
        title: 'Draft release',
        slug,
        content: '',
        labelId: publishedLabel.id,
        draft: true
      })
    ])

    try {
      const responses = await Promise.all([
        webHandler.handler(new Request(`http://localhost/api/content/audio/mix/${slug}`)),
        webHandler.handler(new Request(`http://localhost/api/shows/${slug}`)),
        webHandler.handler(new Request(`http://localhost/api/content/posts/${slug}`)),
        webHandler.handler(new Request(`http://localhost/api/music/labels/slug/${slug}`)),
        webHandler.handler(new Request(`http://localhost/api/content/releases/${slug}`)),
        webHandler.handler(new Request(`http://localhost/api/content/audio/mix/${slug}/edit`)),
        webHandler.handler(new Request(`http://localhost/s/mix/${slug}`)),
        webHandler.handler(new Request(`http://localhost/s/post/${slug}`))
      ])
      expect(responses.map((response) => response.status)).toEqual([
        404, 404, 404, 404, 404, 401, 404, 404
      ])

      const [audioList, audioTags, posts, postTags, episodes, labels, rss] = await Promise.all([
        webHandler.handler(new Request('http://localhost/api/content/audio/mix?limit=100')),
        webHandler.handler(new Request('http://localhost/api/content/audio/mix/tags')),
        webHandler.handler(new Request('http://localhost/api/content/posts?limit=100')),
        webHandler.handler(new Request('http://localhost/api/content/posts/editorials/tags')),
        webHandler.handler(
          new Request(`http://localhost/api/shows/${publishedShow.slug}/episodes?limit=100`)
        ),
        webHandler.handler(new Request('http://localhost/api/music/labels')),
        webHandler.handler(new Request('http://localhost/rss.xml'))
      ])

      expect(JSON.stringify(await audioList.json())).not.toContain(slug)
      expect(await audioTags.json()).not.toContain(tag)
      expect(JSON.stringify(await posts.json())).not.toContain(slug)
      expect(await postTags.json()).not.toContain(tag)
      expect(JSON.stringify(await episodes.json())).not.toContain(`episode-${suffix}`)
      expect(JSON.stringify(await labels.json())).not.toContain(slug)
      expect(await rss.text()).not.toContain(slug)
    } finally {
      await db.delete(releasesTable).where(eq(releasesTable.slug, slug))
      await db.delete(audioTable).where(eq(audioTable.slug, `episode-${suffix}`))
      await db.delete(audioTable).where(eq(audioTable.slug, slug))
      await db.delete(postsTable).where(eq(postsTable.slug, slug))
      await db.delete(showsTable).where(eq(showsTable.slug, slug))
      await db.delete(showsTable).where(eq(showsTable.slug, publishedShow.slug))
      await db.delete(musicLabelsTable).where(eq(musicLabelsTable.slug, slug))
      await db.delete(musicLabelsTable).where(eq(musicLabelsTable.slug, publishedLabel.slug))
    }
  })

  it('GET /rss.xml returns 200 HTML with the feed title', async () => {
    const res = await webHandler.handler(new Request('http://localhost/rss.xml'))

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/html')
    const body = await res.text()
    expect(body).toContain('Goosebumps.fm Mixes RSS Feed')
  })

  it('GET /robots.txt returns 200 plain text pointing at the sitemap', async () => {
    const res = await webHandler.handler(new Request('http://localhost/robots.txt'))

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/plain')
    const body = await res.text()
    expect(body).toContain('Sitemap:')
    expect(body).toContain('/sitemap.xml')
  })

  it('GET /sitemap.xml returns 200 XML with a urlset root', async () => {
    const res = await webHandler.handler(new Request('http://localhost/sitemap.xml'))

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('application/xml')
    const body = await res.text()
    expect(body).toContain('<urlset')
  })

  it('GET /s/mix/:slug returns 404 HTML for an unknown mix', async () => {
    const res = await webHandler.handler(new Request('http://localhost/s/mix/does-not-exist'))

    expect(res.status).toBe(404)
    expect(res.headers.get('content-type')).toContain('text/html')
  })

  it('GET /s/track/:slug returns 404 HTML for an unknown track', async () => {
    const res = await webHandler.handler(new Request('http://localhost/s/track/does-not-exist'))

    expect(res.status).toBe(404)
  })

  it('GET /s/show/:slug returns 404 HTML for an unknown show', async () => {
    const res = await webHandler.handler(new Request('http://localhost/s/show/does-not-exist'))

    expect(res.status).toBe(404)
  })

  it('GET /s/profile/:username returns 404 HTML for an unknown username', async () => {
    const res = await webHandler.handler(new Request('http://localhost/s/profile/does-not-exist'))

    expect(res.status).toBe(404)
  })

  it('GET /s/release/:slug returns 404 HTML for an unknown release', async () => {
    const res = await webHandler.handler(new Request('http://localhost/s/release/does-not-exist'))

    expect(res.status).toBe(404)
  })

  it('GET /s/label/:slug returns 404 HTML for an unknown label', async () => {
    const res = await webHandler.handler(new Request('http://localhost/s/label/does-not-exist'))

    expect(res.status).toBe(404)
  })

  it('GET /s/post/:slug, /s/editorial/:slug, and /s/tweet/:slug all reach the same handler and 404 for an unknown post', async () => {
    const [post, editorial, tweet] = await Promise.all([
      webHandler.handler(new Request('http://localhost/s/post/does-not-exist')),
      webHandler.handler(new Request('http://localhost/s/editorial/does-not-exist')),
      webHandler.handler(new Request('http://localhost/s/tweet/does-not-exist'))
    ])

    expect(post.status).toBe(404)
    expect(editorial.status).toBe(404)
    expect(tweet.status).toBe(404)
  })

  it('GET /s/:slug (catch-all) returns 404 HTML for an unresolvable slug', async () => {
    const res = await webHandler.handler(new Request('http://localhost/s/does-not-exist'))

    expect(res.status).toBe(404)
  })

  it('GET /s/:slug does not shadow the specific /s/mix/:slug route (static routes win over the catch-all)', async () => {
    // Both 404 (unknown slug either way), but the point is /s/mix/foo must be
    // routed to shareMix, not fall through to shareSlug's ResolveService path
    // -- confirmed indirectly: shareMix's 404 message differs from shareSlug's.
    const res = await webHandler.handler(new Request('http://localhost/s/mix/does-not-exist'))
    const body = await res.text()

    expect(res.status).toBe(404)
    expect(body).toContain('Mix not found')
  })
})
