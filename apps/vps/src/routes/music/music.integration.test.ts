import { beforeAll, describe, expect, it } from 'vitest'
import type { AppType } from '@/app'

let app: AppType

beforeAll(async () => {
  const mod = await import('@/app')
  app = mod.default
})

describe('Music API — artists', () => {
  it('GET /music/artists returns 200 with an array', async () => {
    const res = await app.request('/music/artists')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body)).toBe(true)
  })

  it('GET /music/artists/:id returns 404 for unknown id', async () => {
    const res = await app.request(
      '/music/artists/00000000-0000-0000-0000-000000000000'
    )
    expect(res.status).toBe(404)
  })

  it('POST /music/artists returns 401 without auth', async () => {
    const res = await app.request('/music/artists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test Artist', slug: 'test-artist' })
    })
    expect(res.status).toBe(401)
  })
})

describe('Music API — albums', () => {
  it('GET /music/albums returns 200 with an array', async () => {
    const res = await app.request('/music/albums')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body)).toBe(true)
  })

  it('GET /music/albums/:id returns 404 for unknown id', async () => {
    const res = await app.request(
      '/music/albums/00000000-0000-0000-0000-000000000000'
    )
    expect(res.status).toBe(404)
  })

  it('POST /music/albums returns 401 without auth', async () => {
    const res = await app.request('/music/albums', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Test Album', slug: 'test-album' })
    })
    expect(res.status).toBe(401)
  })
})

describe('Music API — tracks', () => {
  it('GET /music/tracks returns 200 with an array', async () => {
    const res = await app.request('/music/tracks')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body)).toBe(true)
  })

  it('GET /music/tracks/:id returns 404 for unknown id', async () => {
    const res = await app.request(
      '/music/tracks/00000000-0000-0000-0000-000000000000'
    )
    expect(res.status).toBe(404)
  })

  it('POST /music/tracks returns 401 without auth', async () => {
    const res = await app.request('/music/tracks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Test Track', slug: 'test-track' })
    })
    expect(res.status).toBe(401)
  })
})

describe('Music API — playlists', () => {
  it('GET /music/playlists returns 200 with an array', async () => {
    const res = await app.request('/music/playlists')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body)).toBe(true)
  })

  it('GET /music/playlists/:id returns 404 for unknown id', async () => {
    const res = await app.request(
      '/music/playlists/00000000-0000-0000-0000-000000000000'
    )
    expect(res.status).toBe(404)
  })

  it('GET /music/playlists/:id/tracks returns 200 with empty array for unknown playlist', async () => {
    const res = await app.request(
      '/music/playlists/00000000-0000-0000-0000-000000000000/tracks'
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body)).toBe(true)
    expect(body).toHaveLength(0)
  })

  it('POST /music/playlists returns 401 without auth', async () => {
    const res = await app.request('/music/playlists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Test Playlist', slug: 'test-playlist' })
    })
    expect(res.status).toBe(401)
  })
})

describe('Music API — links', () => {
  it('GET /music/links/pending returns 401 without auth', async () => {
    const res = await app.request('/music/links/pending')
    expect(res.status).toBe(401)
  })
})
