import { env } from 'cloudflare:workers'
import { describe, expect, test } from 'vitest'
import worker from '../src/index'

const IncomingRequest = Request<unknown, IncomingRequestCfProperties>
const fetchWorker = (request: Request) => worker.fetch(new IncomingRequest(request), env)

describe('CDN router Worker', () => {
  test('serves byte ranges with the original object size', async () => {
    const body = Uint8Array.from({ length: 256 }, (_, index) => index)
    await env.USER_CONTENT.put('range.bin', body)

    const response = await fetchWorker(
      new Request('https://cdn.example/user-content/range.bin', {
        headers: { Range: 'bytes=0-99' }
      })
    )

    expect(response.status).toBe(206)
    expect(response.headers.get('content-range')).toBe('bytes 0-99/256')
    expect(response.headers.get('content-length')).toBe('100')
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(body.slice(0, 100))
  })

  test('serves HEAD metadata without a body', async () => {
    await env.MIXES.put('track.mp3', 'audio bytes', {
      httpMetadata: {
        contentType: 'audio/mpeg',
        cacheControl: 'public, max-age=3600'
      },
      customMetadata: { source: 'migration-test' }
    })

    const response = await fetchWorker(
      new Request('https://cdn.example/mixes/track.mp3', { method: 'HEAD' })
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('audio/mpeg')
    expect(response.headers.get('cache-control')).toBe('public, max-age=3600')
    expect(response.headers.get('content-length')).toBe(String('audio bytes'.length))
    expect(response.headers.get('x-amz-meta-source')).toBe('migration-test')
    expect(await response.text()).toBe('')
  })

  test('returns 304 for matching ETags and unmodified dates', async () => {
    const object = await env.USER_CONTENT.put('conditional.txt', 'conditional body')
    if (object === null) throw new Error('Failed to seed conditional test object')

    const etagResponse = await fetchWorker(
      new Request('https://cdn.example/user-content/conditional.txt', {
        headers: { 'If-None-Match': object.httpEtag }
      })
    )
    const dateResponse = await fetchWorker(
      new Request('https://cdn.example/user-content/conditional.txt', {
        headers: { 'If-Modified-Since': new Date(Date.now() + 60_000).toUTCString() }
      })
    )

    expect(etagResponse.status).toBe(304)
    expect(await etagResponse.text()).toBe('')
    expect(dateResponse.status).toBe(304)
    expect(await dateResponse.text()).toBe('')
  })

  test('returns 404 for missing objects and unmatched prefixes', async () => {
    const missing = await fetchWorker(
      new Request('https://cdn.example/user-content/does-not-exist.jpg')
    )
    const unmatched = await fetchWorker(new Request('https://cdn.example/private/file.txt'))

    expect(missing.status).toBe(404)
    expect(unmatched.status).toBe(404)
  })

  test('sends CORS headers on hits, misses and rejected methods', async () => {
    await env.MIXES.put('cors.mp3', 'audio bytes')

    const hit = await fetchWorker(new Request('https://cdn.example/mixes/cors.mp3'))
    const miss = await fetchWorker(new Request('https://cdn.example/mixes/absent.mp3'))
    const rejected = await fetchWorker(
      new Request('https://cdn.example/mixes/cors.mp3', { method: 'POST' })
    )

    for (const response of [hit, miss, rejected]) {
      expect(response.headers.get('access-control-allow-origin')).toBe('*')
      expect(response.headers.get('access-control-expose-headers')).toBe('ETag')
    }
  })

  test('exposes only the two public R2 bucket bindings', () => {
    const publicBindings = Object.keys(env).filter((name) => !name.startsWith('__VITEST_'))
    expect(publicBindings.toSorted()).toEqual(['MIXES', 'USER_CONTENT'])
  })
})
