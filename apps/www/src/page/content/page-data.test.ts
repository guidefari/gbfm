import { once } from 'node:events'
import { createServer } from 'node:http'

import { AudioPageResponse, type AudioPagePrincipal } from '@gbfm/api/audio'
import { makeStaticSiteMetadata } from '@gbfm/site-metadata'
import { Schema } from 'effect'
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest'

import { Route } from '../../route'
import { loadAudioDetailData } from './page-data'

const principal: AudioPagePrincipal = {
  id: 'fixture-listener',
  name: 'Fixture listener',
  username: null,
  image: null,
  role: 'user',
}

const ready = AudioPageResponse.cases.Ready.make({
  principal,
  audio: {
    id: 'fixture-audio',
    title: 'Fixture audio',
    description: 'Fixture description',
    thumbnailUrl: 'https://example.com/art.webp',
    slug: 'fixture-audio',
    content: 'Fixture body',
    draft: false,
    tags: ['fixture'],
    type: 'mix',
    url: 'https://example.com/audio.mp3',
    showId: null,
    episodeNumber: null,
    playCount: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    compiledContent: '',
    creators: [],
  },
  metadata: makeStaticSiteMetadata('Fixture audio', 'Fixture description', '/mixes/fixture-audio'),
  favorite: 'active',
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

const load = (type: 'mix' | 'track' = 'mix', slug = 'fixture-audio') => {
  const url = new URL(
    `http://www.local/${type === 'mix' ? 'mixes' : 'tracks'}/${encodeURIComponent(slug)}?mode=fixture`,
  )

  const request = new Request(url, { headers: { 'x-request-id': 'fixture-request' } })

  return loadAudioDetailData(
    request,
    request,
    url,
    Route.cases.Detail.make({ kind: type === 'mix' ? 'mixes' : 'tracks', slug }),
    'fixture-request',
    type,
    slug,
  )
}

describe('Audio detail WWW data loading', () => {
  test('one API request provides identity, content, favorite state, metadata and refresh cookies', async () => {
    const page = await load()
    expect(calls).toEqual([
      { path: '/api/content/audio/mix/fixture-audio/page', requestId: 'fixture-request' },
    ])
    expect(page.flags.status).toBe(200)
    expect(page.flags.principal).toEqual(principal)
    expect(page.flags.items[0]?.title).toBe('Fixture audio')
    expect(page.flags.items[0]?.href).toBe('/mixes/fixture-audio')
    expect(page.flags.publicAction).toEqual({
      target: { id: 'fixture-audio', kind: 'audio' },
      path: '/mixes/fixture-audio?mode=fixture',
      state: 'active',
    })
    expect(page.flags.metadata).toEqual(ready.metadata)
    expect(page.identity.cookies).toEqual([])
    expect(page.response?.headers.getSetCookie()).toEqual([
      'fixture-refresh=updated; Path=/; HttpOnly',
    ])
  })

  test('not-found outcomes retain identity and map to the existing 404 flags', async () => {
    payload = Schema.decodeUnknownSync(Schema.Json)(
      AudioPageResponse.cases.NotFound.make({ principal }),
    )
    const { flags } = await load()
    expect(flags.status).toBe(404)
    expect(flags.principal).toEqual(principal)
    expect(flags.items).toEqual([])
    expect(flags.publicAction).toBeNull()
    expect(flags.failure).toBeNull()
    expect(calls).toHaveLength(1)
  })

  test('unavailable outcomes retain identity and do not trigger fallback API fan-out', async () => {
    payload = Schema.decodeUnknownSync(Schema.Json)(
      AudioPageResponse.cases.Unavailable.make({ principal }),
    )
    const { flags } = await load()
    expect(flags.status).toBe(503)
    expect(flags.principal).toEqual(principal)
    expect(flags.failure).toBe('Content is unavailable right now.')
    expect(calls).toHaveLength(1)
  })

  test('invalid API data fails closed rather than accepting an unchecked principal', async () => {
    payload = { principal: { id: 'unvalidated-admin', role: 'admin' } }
    const { flags } = await load()
    expect(flags.status).toBe(503)
    expect(flags.principal).toBeNull()
    expect(flags.items).toEqual([])
  })

  test('transport failures return the existing unavailable state', async () => {
    status = 500
    const { flags } = await load()
    expect(flags.status).toBe(503)
    expect(flags.principal).toBeNull()
    expect(calls).toHaveLength(1)
  })

  test('missing public metadata gets a static fallback without a second read', async () => {
    payload = Schema.decodeUnknownSync(Schema.Json)(
      AudioPageResponse.cases.Ready.make({ ...ready, metadata: null }),
    )
    const { flags } = await load()
    expect(flags.metadata?.kind).toBe('page')
    expect(flags.metadata?.canonicalUrl).toBe('https://goosebumps.fm/mixes/fixture-audio')
    expect(calls).toHaveLength(1)
  })

  test('empty descriptions retain the existing site description fallback', async () => {
    payload = Schema.decodeUnknownSync(Schema.Json)(
      AudioPageResponse.cases.Ready.make({
        ...ready,
        audio: { ...ready.audio, description: '' },
        metadata: null,
      }),
    )
    const { flags } = await load()
    expect(flags.description).toBe('Independent music, mixes and stories on goosebumps.fm.')
    expect(flags.items[0]?.description).toBeNull()
  })

  test('track routes and encoded slugs use the dedicated page endpoint', async () => {
    await load('track', 'fixture / track')
    expect(calls[0]?.path).toBe('/api/content/audio/track/fixture%20%2F%20track/page')
  })
})
