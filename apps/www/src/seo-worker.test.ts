import { describe, expect, test, vi } from 'vitest'
import { makeSiteMetadata, type SiteMetadata } from '@gbfm/site-metadata'
import worker, { handleRequest, type SeoWorkerEnv } from './seo-worker'

const indexHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>goosebumps.fm</title>
  </head>
  <body><div id="root"></div><script src="/app.js"></script></body>
</html>`

const metadata: SiteMetadata = makeSiteMetadata({
  kind: 'tweet',
  title: 'Vusa just resurfaced this',
  description: 'A rediscovered pairing worth hearing.',
  canonicalUrl: 'https://goosebumps.fm/tweet/vusa-just-resurfaced',
  imageUrl:
    'https://goosebumps.fm/social/cards/tweet/vusa-just-resurfaced/0123456789abcdef/open-graph.png',
  imageAlt: 'Vusa just resurfaced this on goosebumps.fm',
  imageWidth: 1200,
  imageHeight: 630,
  creators: ['Vusa'],
  publishedAt: '2026-09-12T10:00:00.000Z',
  modifiedAt: '2026-09-13T11:00:00.000Z',
  audio: null
})

const fetcher = (fetch: SeoWorkerEnv['API']['fetch']): SeoWorkerEnv['API'] => ({ fetch })

const env = (apiResponse: Response = Response.json(metadata)): SeoWorkerEnv => ({
  API: fetcher(async () => apiResponse.clone()),
  ASSETS: fetcher(
    async () => new Response(indexHtml, { headers: { 'content-type': 'text/html' } })
  ),
  SOCIAL_IMAGES: fetcher(async () => new Response('social image'))
})

describe('site metadata worker', () => {
  test.each([
    ['/mixes/a-mix', 'mix'],
    ['/tracks/a-track', 'track'],
    ['/shows/a-show', 'show'],
    ['/releases/a-release', 'release'],
    ['/labels/a-label', 'label'],
    ['/profile/a-user', 'profile'],
    ['/editorial/a-post', 'editorial'],
    ['/tweet/a-tweet', 'tweet'],
    ['/a-user', 'slug']
  ])('resolves %s through the %s metadata projection', async (pathname, kind) => {
    let requestedPath = ''
    const testEnv: SeoWorkerEnv = {
      ...env(),
      API: fetcher(async (request) => {
        requestedPath = new URL(request.url).pathname
        return Response.json(metadata)
      })
    }

    const response = await handleRequest(new Request(`https://goosebumps.fm${pathname}`), testEnv)
    const html = await response.text()

    expect(requestedPath).toBe(`/api/site-metadata/${kind}/${pathname.split('/').pop()}`)
    expect(html).toContain('<title>Vusa just resurfaced this | goosebumps.fm</title>')
    expect(html).toContain('<meta property="og:image:width" content="1200">')
    expect(html).toContain('<link rel="canonical"')
    expect(html).toContain('<script type="application/ld+json">')
    expect(html).toContain('<script src="/app.js"></script>')
  })

  test('escapes contract metadata before inserting it into HTML', async () => {
    const title = 'Music <script>alert("x")</script>'
    const response = await handleRequest(
      new Request('https://goosebumps.fm/tweet/a-tweet'),
      env(Response.json({ ...metadata, title }))
    )
    const html = await response.text()

    expect(html).toContain(
      '<title>Music &lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; | goosebumps.fm</title>'
    )
    expect(html).not.toContain('<script>alert("x")</script>')
    expect(html).toContain('Music \\u003cscript>alert')
  })

  test('returns a noindex 404 document when public metadata does not exist', async () => {
    const testEnv: SeoWorkerEnv = {
      ...env(new Response('Not found', { status: 404 })),
      ASSETS: fetcher(
        async () =>
          new Response(indexHtml, {
            headers: {
              'content-type': 'text/html',
              'cache-control': 'public, max-age=3600',
              etag: 'spa-shell'
            }
          })
      )
    }
    const response = await handleRequest(
      new Request('https://goosebumps.fm/tracks/draft-or-missing'),
      testEnv
    )

    expect(response.status).toBe(404)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(response.headers.has('etag')).toBe(false)
    expect(await response.text()).toContain('<meta name="robots" content="noindex, nofollow">')
  })

  test.each([
    ['/', 'goosebumps.fm'],
    ['/labels', 'Record Labels'],
    ['/tags/deep%20house', '#deep house'],
    ['/invite/charlie3000', 'An invite for Charlie3000']
  ])('injects shared static metadata for %s without an API lookup', async (pathname, title) => {
    const apiFetch = vi.fn(async () => Response.json(metadata))

    const response = await handleRequest(new Request(`https://goosebumps.fm${pathname}`), {
      ...env(),
      API: fetcher(apiFetch)
    })

    expect(response.status).toBe(200)
    expect(await response.text()).toContain(`<title>${title}`)
    expect(apiFetch).not.toHaveBeenCalled()
  })

  test.each(['/mixes', '/tracks', '/tweet/latest', '/auth/sign-in'])(
    'does not misclassify the application route %s as public content',
    async (pathname) => {
      const apiFetch = vi.fn(async () => new Response('Not found', { status: 404 }))

      const response = await handleRequest(new Request(`https://goosebumps.fm${pathname}`), {
        ...env(),
        API: fetcher(apiFetch)
      })

      expect(response.status).toBe(200)
      expect(await response.text()).toBe(indexHtml)
      expect(apiFetch).not.toHaveBeenCalled()
    }
  )

  test('falls back to the ordinary SPA when metadata infrastructure or its contract fails', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const [unavailable, invalid] = await Promise.all([
      handleRequest(
        new Request('https://goosebumps.fm/shows/unavailable'),
        env(new Response('Unavailable', { status: 503 }))
      ),
      handleRequest(
        new Request('https://goosebumps.fm/shows/invalid'),
        env(Response.json({ ...metadata, title: 42 }))
      )
    ])

    expect(await unavailable.text()).toBe(indexHtml)
    expect(await invalid.text()).toBe(indexHtml)
    expect(error).toHaveBeenCalledTimes(1)
    error.mockRestore()
  })

  test.each([
    'https://goosebumps.fm/social/cards/show/far-end-radio/0123456789abcdef/open-graph.png',
    'https://goosebumps.fm/social/tweets/vusa-just-resurfaced/0123456789abcdef/open-graph.png'
  ])('proxies the generated social image route %s to the image worker', async (url) => {
    const response = await handleRequest(new Request(url), env())

    expect(await response.text()).toBe('social image')
  })

  test('proxies the generated sitemap to the API worker before the SPA asset fallback', async () => {
    const apiFetch = vi.fn(
      async () => new Response('<urlset />', { headers: { 'content-type': 'application/xml' } })
    )
    const assetFetch = vi.fn(
      async () => new Response(indexHtml, { headers: { 'content-type': 'text/html' } })
    )
    const request = new Request('https://goosebumps.fm/sitemap.xml')

    const response = await handleRequest(request, {
      API: fetcher(apiFetch),
      ASSETS: fetcher(assetFetch),
      SOCIAL_IMAGES: fetcher(async () => new Response('social image'))
    })

    expect(await response.text()).toBe('<urlset />')
    expect(apiFetch).toHaveBeenCalledWith(request)
    expect(assetFetch).not.toHaveBeenCalled()
  })

  test('passes static assets directly through without metadata API traffic', async () => {
    let apiRequests = 0
    const testEnv: SeoWorkerEnv = {
      API: fetcher(async () => {
        apiRequests += 1
        return Response.json(metadata)
      }),
      ASSETS: fetcher(
        async () => new Response('asset', { headers: { 'content-type': 'application/javascript' } })
      ),
      SOCIAL_IMAGES: fetcher(async () => new Response('social image'))
    }

    const response = await handleRequest(
      new Request('https://goosebumps.fm/assets/app.js'),
      testEnv
    )

    expect(await response.text()).toBe('asset')
    expect(apiRequests).toBe(0)
  })

  test('runtime adapter ignores the ExecutionContext argument', async () => {
    const response = await worker.fetch(new Request('https://goosebumps.fm/tweet/a-tweet'), env(), {
      waitUntil: () => undefined
    })

    expect(response.status).toBe(200)
    expect(await response.text()).toContain('property="og:image"')
  })
})
