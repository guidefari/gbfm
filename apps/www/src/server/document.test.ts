import { runInNewContext } from 'node:vm'

import { makeStaticSiteMetadata } from '@gbfm/site-metadata'
import { dark, light } from '@gbfm/theme'
import * as Server from 'foldkit/experimental/server'
import { afterEach, expect, test, vi } from 'vitest'

import { parseRoute } from '../route'
import { renderDocument } from './document'
import { createPageResponse } from './page-response'

const assets: Server.DocumentAssets = {
  entryScript: '/assets/client-123.js',
  stylesheets: ['/assets/client-456.css'],
  modulePreloads: ['/assets/shared-789.js'],
}

const page = (
  path: string,
  title: string,
  status = 200,
): Parameters<typeof createPageResponse>[3] => {
  const url = new URL(path, 'https://preview.example')

  return {
    redirect: null,
    url,
    route: parseRoute(path),
    requestId: 'document-fixture',
    identity: { principal: null, cookies: ['identity=one; Path=/', 'reader=two; Path=/'] },
    response: null,
    neighbourResponse: null,
    tweetData: null,
    showDetailSlug: null,
    showMetadata: null,
    profile: null,
    flags: {
      url: url.href,
      status,
      title,
      description: title,
      requestId: 'document-fixture',
      principal: null,
      items: [],
      renderedAt: 0,
      skipSeen: false,
      tweet: null,
      neighbours: null,
      dashboard: null,
      profile: null,
      shows: null,
      changelog: null,
      publicAction: null,
      failure: null,
      metadata: makeStaticSiteMetadata(title, title, path),
    },
  }
}

afterEach(() => vi.unstubAllEnvs())

test('document rendering isolates page heads and preserves HTTP metadata, assets and hydration', async () => {
  vi.stubEnv('FOLDKIT_BUILD_ID', 'document-test')
  const first = page('/about', 'Music "&" </script><script>bad()</script>')
  const second = page('/not-a-route', 'Missing fixture', 404)

  const [firstResult, secondResult] = await Promise.all(
    [first, second].map((data) => createPageResponse(new Request(data.url), false, 0, data)),
  )

  if (!firstResult || !secondResult) throw new Error('Missing rendered fixtures')
  expect(firstResult._tag).toBe('Rendered')
  const response = Server.toResponse((app) => renderDocument(app, assets), firstResult)
  const missing = Server.toResponse((app) => renderDocument(app, assets), secondResult)
  const html = await response.text()
  const missingHtml = await missing.text()
  expect(response.status).toBe(200)
  expect(missing.status).toBe(404)
  expect(response.headers.getSetCookie()).toEqual(first.identity.cookies)
  expect(response.headers.get('x-request-id')).toBe('document-fixture')
  expect(response.headers.get('cache-control')).toBe('private, no-store')
  expect(response.headers.get('content-type')).toBe('text/html; charset=utf-8')
  expect(html).toContain('Music &quot;&amp;&quot; &lt;/script&gt;')
  expect(html).not.toContain('<script>bad()</script>')
  expect(html).not.toContain('Missing fixture')
  expect(html).not.toContain('noindex, nofollow')
  expect(missingHtml).toContain('noindex, nofollow')
  expect(missingHtml).not.toContain('bad()')
  expect(html.match(/rel="canonical"/g)).toHaveLength(1)
  expect(html).toContain('href="https://goosebumps.fm/about"')
  expect(html.match(/property="og:url"/g)).toHaveLength(1)
  expect(html.match(/name="viewport"/g)).toHaveLength(1)
  expect(html).toContain('viewport-fit=cover')
  expect(html).toContain('data-foldkit-build="document-test"')
  expect(html).toContain('data-foldkit-flags=')

  for (const asset of [assets.entryScript, ...assets.stylesheets, ...assets.modulePreloads])
    expect(html).toContain(asset)
  expect(html).toContain('/fonts/JetBrainsMono-ExtraBold.woff2')
  expect(html).toContain('/fav.png')
  expect(html).toContain(`background-color: ${dark.backgroundHex}`)
  expect(html).toContain(`background-color: ${light.backgroundHex}`)
})

test('data responses bypass the document and private pages stay noindex', async () => {
  vi.stubEnv('FOLDKIT_BUILD_ID', 'document-test')
  const data = page('/auth/sign-in', 'Account')
  const request = new Request(data.url)
  const json = await createPageResponse(request, true, 0, data)
  expect(json._tag).toBe('Responded')

  const response = Server.toResponse(() => {
    throw new Error('Data must not render')
  }, json)

  expect(await response.json()).toMatchObject({ title: 'Account', status: 200 })
  const rendered = await createPageResponse(request, false, 0, data)
  expect(await Server.toResponse((app) => renderDocument(app, assets), rendered).text()).toContain(
    'noindex, nofollow',
  )
})

test.each(['light', 'dark', 'system', 'blocked'])(
  'early %s theme and queued artwork work before client startup',
  (theme) => {
    const html = renderDocument({ html: '<main>Fixture</main>', title: 'Fixture' }, assets)
    const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1]

    if (!script) throw new Error('Missing early initialization')
    const classes: Array<string> = []
    const properties = new Map<string, string>()
    const dataset: Record<string, string> = {}
    runInNewContext(script, {
      URL,
      localStorage: {
        getItem: (key: string) => {
          if (theme === 'blocked') throw new Error('Storage blocked')

          return key === 'vite-ui-theme'
            ? theme
            : JSON.stringify({
                currentIndex: 1,
                tracks: [
                  { thumbnailUrl: 'https://example.com/wrong.png' },
                  { thumbnailUrl: 'https://cdn.goosebumps.fm/art.png' },
                ],
              })
        },
      },
      matchMedia: () => ({ matches: true }),
      document: {
        documentElement: {
          dataset,
          classList: { add: (value: string) => classes.push(value) },
          style: { setProperty: (name: string, value: string) => properties.set(name, value) },
        },
      },
    })
    expect(classes).toEqual([theme === 'light' ? 'light' : 'dark'])
    expect(dataset.theme).toBe(theme === 'light' ? 'light' : 'dark')

    expect(dataset.queued).toBe(theme === 'blocked' ? undefined : '')
    expect(properties.get('--queued-art')).toBe(
      theme === 'blocked' ? undefined : 'url("https://cdn.goosebumps.fm/art.png?w=96&q=80&f=webp")',
    )
  },
)
