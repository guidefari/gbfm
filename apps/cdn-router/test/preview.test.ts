import { env } from 'cloudflare:workers'
import { describe, expect, test } from 'vitest'

import {
  createPreviewGrant,
  isPrivateMediaPath,
  PREVIEW_TTL_MS,
  verifyPreviewGrant,
} from '../../../packages/core/src/media-preview'
import worker from '../src/index'

const secret = 'disposable-test-preview-key'

const frontend = 'https://www.example'

const audience = 'https://cdn.example'

const path = '/user-content/private/test-user/object/track.mp3'

const cookieName = '__Secure-gbfm-preview'

const IncomingRequest = Request<unknown, IncomingRequestCfProperties>

const bindings = () => ({ ...env, MEDIA_PREVIEW_KEY: secret, MEDIA_PREVIEW_ORIGIN: frontend })

const fetchWorker = (request: Request, config: Env = bindings()) =>
  worker.fetch(new IncomingRequest(request), config)

const grant = (asset = path, expiresAt = Date.now() + 240_000, target = audience) =>
  createPreviewGrant({ path: asset, expiresAt, audience: target }, secret)

const exchange = (token: string, origin: string | null = frontend) => {
  const headers = new Headers({ 'content-type': 'application/json' })

  if (origin !== null) headers.set('origin', origin)

  return fetchWorker(
    new Request(`${audience}/preview-session`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ grant: token }),
    }),
  )
}

const read = (cookie = '', asset = path, init: RequestInit = {}) => {
  const headers = new Headers(init.headers)
  headers.set('origin', frontend)
  headers.set('cookie', cookie)

  return fetchWorker(new Request(`${audience}${asset}`, { ...init, headers }))
}

describe('preview grant codec in Workers', () => {
  test('verifies exact audience, signature, expiry and maximum remaining lifetime', async () => {
    const now = 1_800_000_000_000
    const claims = { path, audience, expiresAt: now + PREVIEW_TTL_MS }
    const token = await createPreviewGrant(claims, secret)
    expect(await verifyPreviewGrant(token, secret, audience, now)).toEqual(claims)
    expect(await verifyPreviewGrant(token, 'wrong', audience, now)).toBeNull()
    expect(await verifyPreviewGrant(token, secret, frontend, now)).toBeNull()
    expect(await verifyPreviewGrant(token, secret, audience, claims.expiresAt)).toBeNull()
    expect(await verifyPreviewGrant(token, secret, audience, now - 1)).toBeNull()

    for (const malformed of [
      '',
      `${token}.x`,
      'a.b',
      `${token}=`,
      token.slice(1),
      'x'.repeat(4097),
    ]) {
      expect(await verifyPreviewGrant(malformed, secret, audience, now)).toBeNull()
    }
  })

  test('accepts only canonical private paths and signing audience origins', async () => {
    expect(isPrivateMediaPath(path)).toBe(true)
    expect(isPrivateMediaPath('/mixes/private/test-user/object/track.mp3')).toBe(true)

    for (const invalid of [
      '/user-content/public.mp3',
      `${path}?x=1`,
      '/user-content/private/../track.mp3',
      '/user-content/private/%2e/track.mp3',
      '/user-content/private//track.mp3',
      '/user-content/private/a\\b',
    ]) {
      expect(isPrivateMediaPath(invalid)).toBe(false)
      await expect(grant(invalid)).rejects.toThrow('Invalid preview grant configuration')
    }

    await expect(grant(path, Date.now() + 1000, `${audience}/`)).rejects.toThrow()
  })
})

describe('private CDN access through real R2 bindings', () => {
  test('denies anonymous GET, HEAD, ranges and conditionals before revealing object metadata', async () => {
    await env.USER_CONTENT.put(path.slice('/user-content/'.length), 'private audio', {
      httpMetadata: { cacheControl: 'public, max-age=3600' },
    })

    for (const init of [
      {},
      { method: 'HEAD' },
      { headers: { Range: 'bytes=0-2' } },
      { headers: { 'If-None-Match': '*' } },
    ]) {
      const response = await read('', path, init)
      expect(response.status).toBe(403)
      expect(response.headers.get('cache-control')).toBe('private, no-store')
      expect(response.headers.get('etag')).toBeNull()
      expect(response.headers.get('access-control-allow-origin')).toBe(frontend)
      expect(response.headers.get('access-control-allow-credentials')).toBe('true')
    }
  })

  test('exchanges and renews exact-path cookies; same stable URL supports ranges, HEAD and 304', async () => {
    const body = '0123456789'

    const object = await env.USER_CONTENT.put(path.slice('/user-content/'.length), body, {
      httpMetadata: { cacheControl: 'public, max-age=3600' },
    })

    if (object === null) throw new Error('Failed to seed private object')

    for (const token of [await grant(), await grant(path, Date.now() + 290_000)]) {
      const response = await exchange(token)
      expect(response.status).toBe(204)
      expect(response.headers.get('cache-control')).toBe('private, no-store')
      expect(response.headers.get('vary')).toBe('Origin')
      const setCookie = response.headers.get('set-cookie') ?? ''
      expect(setCookie).toContain(`Path=${path};`)
      expect(setCookie).toContain('HttpOnly; Secure; SameSite=Strict')
      expect(setCookie).not.toContain('Domain=')
      const cookie = setCookie.split(';')[0] ?? ''
      const full = await read(cookie)
      expect(full.status).toBe(200)
      expect(await full.text()).toBe(body)
      const partial = await read(cookie, path, { headers: { Range: 'bytes=2-5' } })
      expect(partial.status).toBe(206)
      expect(partial.headers.get('content-range')).toBe('bytes 2-5/10')
      expect(await partial.text()).toBe('2345')
      const head = await read(cookie, path, { method: 'HEAD' })
      expect(head.status).toBe(200)
      expect(await head.text()).toBe('')

      const conditional = await read(cookie, path, {
        headers: { 'If-None-Match': object.httpEtag },
      })

      expect(conditional.status).toBe(304)

      for (const result of [full, partial, head, conditional])
        expect(result.headers.get('cache-control')).toBe('private, no-store')
    }
  })

  test('rejects expired, tampered, foreign audience and cross-asset cookies; duplicate valid cookie wins', async () => {
    await env.USER_CONTENT.put(path.slice('/user-content/'.length), 'audio')
    const valid = await grant()
    const other = await grant('/user-content/private/test-user/other/track.mp3')

    for (const invalid of [
      await grant(path, Date.now() - 1),
      `${valid.slice(0, -2)}xx`,
      await grant(path, Date.now() + 1000, frontend),
      other,
    ]) {
      expect((await read(`${cookieName}=${invalid}`)).status).toBe(403)
    }

    for (const cookie of [
      `${cookieName}=${other}; ${cookieName}=${valid}`,
      `${cookieName}=${valid}; ${cookieName}=${other}`,
    ]) {
      expect((await read(cookie)).status).toBe(200)
    }
  })

  test('never serves private mixes or encoded URL aliases anonymously or with a canonical cookie', async () => {
    await env.MIXES.put('private/test-user/object/track.mp3', 'mix secret')
    const cookie = `${cookieName}=${await grant()}`

    for (const alias of [
      '/mixes/private/test-user/object/track.mp3',
      '/user-content/%70rivate/test-user/object/track.mp3',
      '/user-content/private%2ftest-user/object/track.mp3',
      '/user-content/private/test-user//object/track.mp3',
      '/user-content/private/test-user/%2e%2e/object/track.mp3',
    ]) {
      for (const credentials of ['', cookie]) {
        const response = await read(credentials, alias)
        expect(response.status).toBeGreaterThanOrEqual(400)
        expect(response.headers.get('cache-control')).toBe('private, no-store')
      }
    }
  })

  test('exchange requires exact Origin and correct audience; OPTIONS only allows approved origin', async () => {
    const token = await grant()

    for (const origin of [null, 'null', 'https://evil.example', `${frontend}/`]) {
      const response = await exchange(token, origin)
      expect(response.status).toBe(403)
      expect(response.headers.get('access-control-allow-origin')).toBeNull()
      expect(response.headers.get('set-cookie')).toBeNull()
    }

    for (const invalid of [
      'invalid',
      await grant(path, Date.now() - 1),
      await grant(path, Date.now() + 1000, frontend),
    ])
      expect((await exchange(invalid)).status).toBe(403)

    for (const origin of [frontend, 'https://evil.example']) {
      const response = await fetchWorker(
        new Request(`${audience}/preview-session`, { method: 'OPTIONS', headers: { origin } }),
      )

      expect(response.status).toBe(origin === frontend ? 204 : 403)
      expect(response.headers.get('cache-control')).toBe('private, no-store')
    }
  })

  test('missing configuration fails private closed without changing public delivery', async () => {
    await env.USER_CONTENT.put('public-track.mp3', 'public')
    const config = { ...bindings(), MEDIA_PREVIEW_KEY: '' }
    expect((await fetchWorker(new Request(`${audience}${path}`), config)).status).toBe(503)

    const response = await fetchWorker(
      new Request(`${audience}/user-content/public-track.mp3`),
      config,
    )

    expect(response.status).toBe(200)
    expect(await response.text()).toBe('public')
    expect(response.headers.get('access-control-allow-origin')).toBe('*')
    expect(response.headers.get('access-control-allow-credentials')).toBeNull()
  })

  test('existing public keys keep literal URL spelling rather than decoding storage keys', async () => {
    for (const key of ['public/track%20name.mp3', 'public/double//segment.mp3']) {
      await env.USER_CONTENT.put(key, 'literal public object')
      const response = await read('', `/user-content/${key}`)
      expect(response.status).toBe(200)
      expect(await response.text()).toBe('literal public object')
      expect(response.headers.get('access-control-allow-origin')).toBe('*')
    }
  })

  test('comma-delimited frontend origins match exactly and never use wildcard CORS', async () => {
    const config = {
      ...bindings(),
      MEDIA_PREVIEW_ORIGIN: 'https://goosebumps.fm, https://www.goosebumps.fm',
    }

    const token = await grant(
      '/user-content/private/test-user/multipart/object/123/audio_track.mp3',
    )

    for (const origin of [
      'https://goosebumps.fm',
      'https://www.goosebumps.fm',
      'https://evil.goosebumps.fm',
      'https://goosebumps.fm.evil.example',
      'https://goosebumps.fm/',
    ]) {
      const approved = origin === 'https://goosebumps.fm' || origin === 'https://www.goosebumps.fm'

      const response = await fetchWorker(
        new Request(`${audience}/preview-session`, {
          method: 'POST',
          headers: { origin, 'content-type': 'application/json' },
          body: JSON.stringify({ grant: token }),
        }),
        config,
      )

      expect(response.status).toBe(approved ? 204 : 403)
      expect(response.headers.get('access-control-allow-origin')).toBe(approved ? origin : null)
      expect(response.headers.get('access-control-allow-credentials')).toBe(
        approved ? 'true' : null,
      )
    }
  })

  test('rejects malformed exchange input without returning a cookie', async () => {
    for (const body of [
      '{',
      'null',
      '{}',
      '{"grant":2}',
      '{"grant":"bad","extra":true}',
      ' '.repeat(8193),
    ]) {
      const response = await fetchWorker(
        new Request(`${audience}/preview-session`, {
          method: 'POST',
          headers: { origin: frontend, 'content-type': 'application/json' },
          body,
        }),
      )

      expect(response.status).toBe(400)
      expect(response.headers.get('set-cookie')).toBeNull()
      expect(response.headers.get('cache-control')).toBe('private, no-store')
    }
  })

  test('private image fallback, missing objects and method failures never inherit public cache metadata', async () => {
    const imagePath = '/user-content/private/test-user/object/cover.png'
    await env.USER_CONTENT.put(imagePath.slice('/user-content/'.length), 'image bytes', {
      httpMetadata: {
        contentType: 'image/png',
        cacheControl: 'public, max-age=31536000, immutable',
      },
    })
    const cookie = `${cookieName}=${await grant(imagePath)}`
    // Invalid image input exercises the Images binding's failure and original-body fallback.
    const image = await read(cookie, `${imagePath}?w=100&f=webp`)
    expect(image.status).toBe(200)
    expect(new TextDecoder().decode(await image.arrayBuffer())).toBe('image bytes')
    expect(image.headers.get('cache-control')).toBe('private, no-store')
    expect(image.headers.get('content-security-policy')).toBe(
      "sandbox; default-src 'none'; style-src 'unsafe-inline'",
    )
    expect(image.headers.get('x-content-type-options')).toBe('nosniff')
    const missingPath = '/user-content/private/test-user/object/missing.png'
    const missing = await read(`${cookieName}=${await grant(missingPath)}`, missingPath)
    expect(missing.status).toBe(404)
    expect(missing.headers.get('cache-control')).toBe('private, no-store')
    const method = await read(cookie, imagePath, { method: 'POST' })
    expect(method.status).toBe(405)
    expect(method.headers.get('cache-control')).toBe('private, no-store')
  })

  test('successful private image transformations remain authenticated and no-store', async () => {
    const imagePath = '/user-content/private/test-user/image/pixel.png'

    const png = Uint8Array.from(
      atob(
        'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACAQMAAABIeJ9nAAAAA1BMVEX/AAAZ4gk3AAAADElEQVQI12NgYGAAAAAEAAEnNCcKAAAAAElFTkSuQmCC',
      ),
      (char) => char.charCodeAt(0),
    )

    await env.USER_CONTENT.put(imagePath.slice('/user-content/'.length), png, {
      httpMetadata: { contentType: 'image/png', cacheControl: 'public, max-age=31536000' },
    })
    expect((await read('', `${imagePath}?w=10&f=webp`)).status).toBe(403)
    const image = await read(`${cookieName}=${await grant(imagePath)}`, `${imagePath}?w=10&f=webp`)
    expect(image.status).toBe(200)
    expect(image.headers.get('content-type')).toBe('image/webp')
    expect(image.headers.get('cache-control')).toBe('private, no-store')
    expect(image.headers.get('access-control-allow-origin')).toBe(frontend)
    expect((await image.arrayBuffer()).byteLength).toBeGreaterThan(0)
  })
})
