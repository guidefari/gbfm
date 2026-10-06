import { once } from 'node:events'
import { createServer } from 'node:http'

import type { AudioPagePrincipal } from '@gbfm/api/audio'
import { ShowPageResponse } from '@gbfm/api/shows'
import { makeStaticSiteMetadata } from '@gbfm/site-metadata'
import { Schema } from 'effect'
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest'

import { Route } from '../../route'
import { loadShowDetailData } from './detail-page-data'
import { loadShowsData } from './page-data'

const principal: AudioPagePrincipal = {
  id: 'fixture-listener',
  name: 'Listener',
  username: null,
  image: null,
  role: 'user',
}

const show = {
  id: 'fixture-show',
  slug: 'fixture-show',
  title: 'Fixture show',
  description: 'Fixture description',
  thumbnailUrl: 'https://example.com/show.webp',
  bannerImageUrl: null,
  content: '',
  draft: false,
  tags: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  hosts: [{ id: 'fixture-host', name: 'Host', username: 'host' }],
  compiledContent: '',
}

const ready = ShowPageResponse.cases.Ready.make({
  principal,
  show,
  shows: [show],
  subscription: 'active',
  episodes: { data: [], pagination: { total: 0, limit: 100, offset: 0, hasMore: false } },
  metadata: makeStaticSiteMetadata('Fixture show', 'Fixture description', '/shows/fixture-show'),
})

let payload: Schema.Json = Schema.decodeUnknownSync(Schema.Json)(ready)

let status = 200

const calls: Array<{ path: string; requestId: string | Array<string> | undefined }> = []

const server = createServer((request, response) => {
  calls.push({ path: request.url ?? '', requestId: request.headers['x-request-id'] })
  response.writeHead(status, {
    'content-type': 'application/json',
    'set-cookie': 'fixture-refresh=updated; Path=/; HttpOnly',
  })
  response.end(JSON.stringify(payload))
})

const previousTarget = process.env.VPS_PROXY_TARGET

beforeAll(async () => {
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')

  const { port } = Schema.decodeUnknownSync(Schema.Struct({ port: Schema.Number }))(
    server.address(),
  )

  process.env.VPS_PROXY_TARGET = `http://127.0.0.1:${port}`
})

beforeEach(() => {
  calls.length = 0
  payload = Schema.decodeUnknownSync(Schema.Json)(ready)
  status = 200
})

afterAll(async () => {
  if (previousTarget === undefined) delete process.env.VPS_PROXY_TARGET
  else process.env.VPS_PROXY_TARGET = previousTarget
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  )
})

const load = (slug = 'fixture-show') => {
  const url = new URL(`http://www.local/shows/${encodeURIComponent(slug)}?mode=fixture`)
  const request = new Request(url, { headers: { 'x-request-id': 'fixture-request' } })

  return loadShowDetailData(
    request,
    request,
    url,
    Route.cases.Detail.make({ kind: 'shows', slug }),
    'fixture-request',
    slug,
  )
}

describe('Show detail WWW page loading', () => {
  test('one request supplies identity, show, dial, episodes, subscription, metadata and refresh cookies', async () => {
    const page = await load()
    expect(calls).toEqual([{ path: '/api/shows/fixture-show/page', requestId: 'fixture-request' }])
    expect(page.flags.status).toBe(200)
    expect(page.flags.principal).toEqual(principal)
    expect(page.flags.items[0]?.href).toBe('/shows/fixture-show')
    expect(page.flags.title).toBe('Fixture show')
    expect(page.flags.shows?.selectedSlug).toBe('fixture-show')
    expect(page.flags.shows?.episodes?.data).toEqual([])
    expect(page.flags.publicAction).toEqual({
      target: { kind: 'show', id: show.id },
      path: '/shows/fixture-show?mode=fixture',
      state: 'active',
    })
    expect(page.flags.metadata).toEqual(ready.metadata)
    expect(page.response?.headers.getSetCookie()).toEqual([
      'fixture-refresh=updated; Path=/; HttpOnly',
    ])
    expect(page.identity.cookies).toEqual([])
  })

  test('404 and 503 outcomes retain identity without fallback fan-out', async () => {
    for (const outcome of [
      ShowPageResponse.cases.NotFound.make({ principal }),
      ShowPageResponse.cases.Unavailable.make({ principal }),
    ]) {
      calls.length = 0
      payload = Schema.decodeUnknownSync(Schema.Json)(outcome)
      const page = await load()
      expect(page.flags.status).toBe(ShowPageResponse.guards.NotFound(outcome) ? 404 : 503)
      expect(page.flags.principal).toEqual(principal)
      expect(page.flags.publicAction).toBeNull()
      expect(page.flags.shows).toBeNull()
      expect(page.flags.failure).toBe(
        ShowPageResponse.guards.Unavailable(outcome) ? 'Content is unavailable right now.' : null,
      )
      expect(calls).toHaveLength(1)
    }
  })

  test('transport and invalid-payload failures fail closed', async () => {
    status = 500
    expect((await load()).flags.status).toBe(503)
    status = 200
    payload = { principal: { id: 'unchecked-admin', role: 'admin' } }
    const { flags } = await load()
    expect(flags.status).toBe(503)
    expect(flags.principal).toBeNull()
  })

  test('optional failures retain the selected show and unavailable episode and action state', async () => {
    payload = Schema.decodeUnknownSync(Schema.Json)(
      ShowPageResponse.cases.Ready.make({
        ...ready,
        shows: [],
        episodes: null,
        metadata: null,
        subscription: 'unavailable',
      }),
    )
    const { flags } = await load()
    expect(flags.status).toBe(200)
    expect(flags.shows?.shows[0]?.id).toBe(show.id)
    expect(flags.shows?.episodes).toBeNull()
    expect(flags.publicAction?.state).toBe('unavailable')
    expect(flags.metadata?.kind).toBe('page')
    expect(calls).toHaveLength(1)
  })

  test('selected content is reused rather than replaced by a stale navigation projection', async () => {
    payload = Schema.decodeUnknownSync(Schema.Json)(
      ShowPageResponse.cases.Ready.make({
        ...ready,
        shows: [{ ...show, title: 'Stale navigation title' }],
      }),
    )
    const { flags } = await load()
    expect(flags.shows?.shows[0]?.title).toBe('Fixture show')
  })

  test('selected shows outside the bounded dial remain renderable', async () => {
    payload = Schema.decodeUnknownSync(Schema.Json)(
      ShowPageResponse.cases.Ready.make({ ...ready, shows: [] }),
    )
    const { flags } = await load()
    expect(flags.shows?.shows.map((show) => show.slug)).toEqual(['fixture-show'])
  })

  test('detail loading encodes slugs and the listing loader no longer starts detail fan-out', async () => {
    await load('fixture / show')
    expect(calls[0]?.path).toBe('/api/shows/fixture%20%2F%20show/page')
    const url = new URL('http://www.local/shows/fixture-show')
    expect(
      loadShowsData(
        new Request(url),
        '/api/shows/fixture-show',
        Route.cases.Detail.make({ kind: 'shows', slug: 'fixture-show' }),
        url,
      ),
    ).toBeNull()
    expect(calls).toHaveLength(1)
  })
})
