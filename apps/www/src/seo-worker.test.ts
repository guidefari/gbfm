import { describe, expect, test } from 'vitest'
import { buildTweetCardPresentation } from '@gbfm/tweet-card'
import { handleRequest, type SeoWorkerEnv } from './seo-worker'

const tweet = {
  id: 'post-1',
  title: 'Vusa just resurfaced this. Pairs well with the lounge',
  description: 'A rediscovered pairing worth hearing.',
  thumbnailUrl: 'https://cdn.example.com/tweet.png',
  slug: 'vusa-just-resurfaced',
  content: 'The full post body',
  draft: false,
  tags: ['music'],
  type: 'micro' as const,
  musicEntityType: null,
  musicEntityId: null,
  parentPostId: null,
  rootPostId: null,
  depth: 0,
  quotedPostId: null,
  createdAt: '2026-09-12T10:00:00.000Z',
  updatedAt: '2026-09-13T11:00:00.000Z',
  compiledContent: '<p>The full post body</p>',
  creators: [{ id: 'creator-1', name: 'Vusa', username: 'vusa' }],
  replyCount: 0
}

const indexHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>goosebumps.fm</title>
  </head>
  <body><div id="root"></div><script src="/app.js"></script></body>
</html>`

const fetcher = (fetch: SeoWorkerEnv['API']['fetch']): SeoWorkerEnv['API'] => ({ fetch })

const env = async (apiResponse: Response): Promise<SeoWorkerEnv> => {
  const presentation = await buildTweetCardPresentation({
    slug: tweet.slug,
    commentary: tweet.title,
    createdAt: tweet.createdAt,
    creator: { name: 'Vusa', username: 'vusa', avatarUrl: null },
    entity: null
  })
  return {
    API: fetcher(async (request) =>
      new URL(request.url).pathname.endsWith('/share-presentation')
        ? Response.json(presentation)
        : apiResponse.clone()
    ),
    ASSETS: fetcher(
      async () => new Response(indexHtml, { headers: { 'content-type': 'text/html' } })
    ),
    SOCIAL_IMAGES: fetcher(async () => new Response('social image'))
  }
}

describe('canonical tweet metadata worker', () => {
  test('returns the SPA document with server-resolved tweet metadata', async () => {
    const response = await handleRequest(
      new Request('https://goosebumps.fm/tweet/vusa-just-resurfaced'),
      await env(Response.json(tweet))
    )
    const html = await response.text()

    expect(response.status).toBe(200)
    expect(html).toContain(
      '<title data-gbfm-edge-seo>Vusa just resurfaced this. Pairs well with the lounge | goosebumps.fm</title>'
    )
    expect(html).toContain(
      '<meta property="og:title" content="Vusa just resurfaced this. Pairs well with the lounge | goosebumps.fm" data-gbfm-edge-seo>'
    )
    expect(html).toContain(
      '<meta property="og:description" content="A rediscovered pairing worth hearing." data-gbfm-edge-seo>'
    )
    expect(html).toMatch(
      /<meta property="og:image" content="https:\/\/goosebumps.fm\/social\/tweets\/vusa-just-resurfaced\/[a-f0-9]{16}\/open-graph.png" data-gbfm-edge-seo>/
    )
    expect(html).toContain('<meta property="og:image:width" content="1200" data-gbfm-edge-seo>')
    expect(html).toContain('<meta property="og:image:height" content="630" data-gbfm-edge-seo>')
    expect(html).toContain(
      '<link rel="canonical" href="https://goosebumps.fm/tweet/vusa-just-resurfaced" data-gbfm-edge-seo>'
    )
    expect(html).toContain('<script type="application/ld+json" data-gbfm-edge-seo>')
    expect(html).toContain('<script src="/app.js"></script>')
    expect(html.match(/property="og:title"/g)).toHaveLength(1)
    expect(html).not.toContain('http-equiv="refresh"')
  })

  test('escapes metadata before inserting it into HTML', async () => {
    const title = 'Music <script>alert("x")</script>'
    const response = await handleRequest(
      new Request('https://goosebumps.fm/tweet/vusa-just-resurfaced'),
      await env(Response.json({ ...tweet, title }))
    )
    const html = await response.text()
    const jsonLd = html.match(
      /<script type="application\/ld\+json" data-gbfm-edge-seo>(.*?)<\/script>/
    )?.[1]

    expect(html).toContain(
      '<title data-gbfm-edge-seo>Music &lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; | goosebumps.fm</title>'
    )
    expect(html).not.toContain('<script>alert("x")</script>')
    expect(JSON.parse(jsonLd ?? '')).toMatchObject({ headline: title })
  })

  test('serves the ordinary SPA when metadata cannot be resolved', async () => {
    const response = await handleRequest(
      new Request('https://goosebumps.fm/tweet/does-not-exist'),
      await env(new Response('Not found', { status: 404 }))
    )

    expect(await response.text()).toBe(indexHtml)
  })

  test('serves the ordinary SPA when the API response violates its contract', async () => {
    const response = await handleRequest(
      new Request('https://goosebumps.fm/tweet/invalid-response'),
      await env(Response.json({ ...tweet, title: 42 }))
    )

    expect(await response.text()).toBe(indexHtml)
  })

  test('keeps tweet metadata and its thumbnail when social image resolution fails', async () => {
    const testEnv = await env(Response.json(tweet))
    const response = await handleRequest(
      new Request('https://goosebumps.fm/tweet/vusa-just-resurfaced'),
      {
        ...testEnv,
        API: fetcher(async (request) =>
          new URL(request.url).pathname.endsWith('/share-presentation')
            ? Response.json({ invalid: true })
            : Response.json(tweet)
        )
      }
    )
    const html = await response.text()

    expect(html).toContain(
      '<meta property="og:image" content="https://cdn.example.com/tweet.png" data-gbfm-edge-seo>'
    )
    expect(html).toContain(
      '<title data-gbfm-edge-seo>Vusa just resurfaced this. Pairs well with the lounge | goosebumps.fm</title>'
    )
    expect(html).not.toContain('og:image:width')
    expect(html).not.toContain('og:image:height')
  })

  test('proxies generated social image requests to the image worker', async () => {
    const testEnv = await env(Response.json(tweet))
    const response = await handleRequest(
      new Request(
        'https://goosebumps.fm/social/tweets/vusa-just-resurfaced/0123456789abcdef/poster.png'
      ),
      testEnv
    )

    expect(await response.text()).toBe('social image')
  })

  test('passes non-document and non-tweet requests directly to static assets', async () => {
    let apiRequests = 0
    const testEnv: SeoWorkerEnv = {
      API: fetcher(async () => {
        apiRequests += 1
        return Response.json(tweet)
      }),
      ASSETS: fetcher(async () => new Response('asset')),
      SOCIAL_IMAGES: fetcher(async () => new Response('social image'))
    }

    const response = await handleRequest(
      new Request('https://goosebumps.fm/assets/app.js', {
        headers: { accept: 'application/javascript' }
      }),
      testEnv
    )

    expect(await response.text()).toBe('asset')
    expect(apiRequests).toBe(0)
  })
})
