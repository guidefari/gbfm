/* oxlint-disable anti-slop-effect/no-manual-tagged-construction -- Assertions describe the public tagged render block. */
import type { SafeUrl } from '@gbfm/rich-content/schema'
import { Effect } from 'effect'
import { describe, expect, test } from 'vitest'

import {
  ExternalMediaFetcher,
  fetchBandcampPage,
  makeExternalMediaResolver,
  MAX_BANDCAMP_PAGE_BYTES,
  parseBandcampPage,
} from './external-media'

const trackPage = 'https://artist.bandcamp.com/track/night-vigil' satisfies SafeUrl

const bandcampHtml = `<html><head>
<meta property="og:title" content="Night Vigil, by A &amp; B">
<meta name="bc-page-properties" content="{&quot;item_type&quot;:&quot;t&quot;,&quot;item_id&quot;:1395951450,&quot;tralbum_page_version&quot;:0}">
</head></html>`

const html = (body: BodyInit, init: ResponseInit = {}) => {
  const headers = new Headers(init.headers)

  if (!headers.has('content-type')) headers.set('content-type', 'text/html; charset=utf-8')

  return new Response(body, { ...init, headers })
}

const redirect = (location: string) => new Response(null, { status: 302, headers: { location } })

const resolveWith = (fetcher: (url: string) => Promise<Response>, urls: ReadonlyArray<SafeUrl>) =>
  Effect.runPromise(
    Effect.gen(function* () {
      const resolver = yield* makeExternalMediaResolver

      return yield* Effect.forEach(urls, (url) => resolver.resolve(url))
    }).pipe(Effect.provideService(ExternalMediaFetcher, fetcher)),
  )

describe('parseBandcampPage', () => {
  test('reads the entity-escaped release ID and title Bandcamp publishes', () => {
    expect(parseBandcampPage(bandcampHtml)).toEqual({
      kind: 'track',
      id: '1395951450',
      title: 'Night Vigil, by A & B',
    })
  })

  test('falls back to the Open Graph player for album pages', () => {
    expect(
      parseBandcampPage(
        '<meta property="og:video" content="https://bandcamp.com/EmbeddedPlayer/v=2/album=42/size=large/">',
      ),
    ).toEqual({ kind: 'album', id: '42', title: null })
  })

  test('returns null for pages without a release', () => {
    expect(parseBandcampPage('<meta name="bc-page-properties" content="{}">')).toBeNull()
  })
})

describe('external media resolver', () => {
  test('turns a Bandcamp release page into its player and keeps the page as the link', async () => {
    const requested: Array<string> = []

    const [first, second] = await resolveWith(
      async (url) => {
        requested.push(url)

        return html(bandcampHtml)
      },
      [trackPage, trackPage],
    )

    expect(first).toMatchObject({
      _tag: 'ExternalMediaEmbed',
      provider: 'bandcamp',
      canonicalUrl: trackPage,
      title: 'Night Vigil, by A & B',
    })
    expect(first?.embedUrl).toMatch(/^https:\/\/bandcamp\.com\/EmbeddedPlayer\/track=1395951450\//)
    expect(second).toEqual(first)
    expect(requested).toEqual([trackPage])
  })

  test('reports no player when the provider page cannot be read', async () => {
    const [missing, rejected] = await resolveWith(
      async (url) => {
        if (url.includes('missing')) return new Response('Not found', { status: 404 })

        throw new Error('network down')
      },
      ['https://artist.bandcamp.com/album/missing', 'https://artist.bandcamp.com/track/offline'],
    )

    expect(missing).toBeNull()
    expect(rejected).toBeNull()
  })

  test('derives other players without fetching', async () => {
    const [youtube] = await resolveWith(
      () => Promise.reject(new Error('must not fetch')),
      ['https://youtu.be/abc123'],
    )

    expect(youtube).toMatchObject({
      provider: 'youtube',
      embedUrl: 'https://www.youtube-nocookie.com/embed/abc123',
    })
  })

  describe('Bandcamp fetch boundary', () => {
    const lookup = (respond: (url: string) => Response) => {
      const requested: Array<string> = []

      return {
        requested,
        result: fetchBandcampPage(
          async (url, init) => {
            expect(init?.redirect).toBe('manual')
            requested.push(url)

            return respond(url)
          },
          trackPage,
          new AbortController().signal,
        ),
      }
    }

    test('never requests a redirect target outside Bandcamp release pages', async () => {
      for (const location of [
        'https://169.254.169.254/latest/meta-data',
        'http://artist.bandcamp.com/track/night-vigil',
        'https://bandcamp.com.evil.test/track/x',
        'https://artist.bandcamp.com:8443/track/x',
        'https://artist.bandcamp.com/music',
      ]) {
        const { requested, result } = lookup(() => redirect(location))

        expect(await result).toBeNull()
        expect(requested).toEqual([trackPage])
      }
    })

    test('follows a bounded number of Bandcamp-to-Bandcamp redirects', async () => {
      const moved = 'https://artist.bandcamp.com/track/night-vigil-2'

      const followed = lookup((url) =>
        url === trackPage ? redirect('/track/night-vigil-2') : html(bandcampHtml),
      )

      expect(await followed.result).toMatchObject({ id: '1395951450' })
      expect(followed.requested).toEqual([trackPage, moved])

      const looping = lookup(() => redirect(trackPage))

      expect(await looping.result).toBeNull()
      expect(looping.requested).toHaveLength(3)
    })

    test('rejects non-HTML responses and stops reading after the size bound', async () => {
      expect(await lookup(() => new Response(bandcampHtml)).result).toBeNull()

      let sent = 0
      const chunk = new TextEncoder().encode(`<!-- ${'x'.repeat(64 * 1024)} -->`)

      const endless = new ReadableStream<Uint8Array>({
        pull: (controller) => {
          sent += chunk.byteLength
          controller.enqueue(chunk)
        },
      })

      expect(await lookup(() => html(endless)).result).toBeNull()
      expect(sent).toBeLessThan(MAX_BANDCAMP_PAGE_BYTES + 3 * chunk.byteLength)
    })

    test('stops reading once the page head is complete', async () => {
      let pulls = 0
      const encoder = new TextEncoder()

      const page = new ReadableStream<Uint8Array>({
        pull: (controller) => {
          pulls += 1
          controller.enqueue(encoder.encode(pulls === 1 ? bandcampHtml : 'body bytes'))
        },
      })

      expect(await lookup(() => html(page)).result).toMatchObject({ kind: 'track' })
      expect(pulls).toBeLessThanOrEqual(2)
    })
  })
})
