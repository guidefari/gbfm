import { describe, expect, test } from 'vitest'

import {
  getStaticSiteMetadata,
  makeAudioSiteMetadata,
  makeProfileSiteMetadata,
  makeStaticSiteMetadata,
  renderDocumentHead,
  renderMetadataHtml,
  SITE_DEFAULT_IMAGE,
  type SiteMetadata,
} from './index'

const metadata: SiteMetadata = {
  schemaVersion: 1,
  kind: 'editorial',
  title: 'A <strange> & useful post',
  description: 'Read "this" safely',
  canonicalUrl: 'https://goosebumps.fm/editorial/strange',
  image: {
    url: SITE_DEFAULT_IMAGE,
    alt: 'A strange post',
    width: 1200,
    height: 630,
  },
  creators: ['Guide Fari'],
  publishedAt: '2026-09-01T00:00:00.000Z',
  modifiedAt: '2026-09-12T00:00:00.000Z',
  audio: null,
}

describe('site metadata', () => {
  test('projects one model into complete document metadata', () => {
    const head = renderDocumentHead(metadata)

    expect(head.meta).toContainEqual({ property: 'og:type', content: 'article' })
    expect(head.meta).toContainEqual({ property: 'og:image:width', content: '1200' })
    expect(head.links).toEqual([{ rel: 'canonical', href: metadata.canonicalUrl }])
    expect(JSON.parse(head.scripts[0]?.children ?? '')).toMatchObject({
      '@type': 'Article',
      headline: metadata.title,
      datePublished: metadata.publishedAt,
    })
  })

  test('escapes HTML while preserving JSON-LD content', () => {
    const html = renderMetadataHtml(metadata)

    expect(html).toContain('<title>A &lt;strange&gt; &amp; useful post | goosebumps.fm</title>')
    expect(html).not.toContain('<strange>')
    expect(html).toContain('A \\u003cstrange> & useful post')
  })

  test('show titles identify hosts without renaming the show in structured data', () => {
    const show = {
      ...metadata,
      kind: 'show' as const,
      title: 'FAR END RADIO',
      creators: ['[kimetsu.]', 'Guest'],
    }

    const head = renderDocumentHead(show)
    expect(head.meta).toContainEqual({
      title: 'FAR END RADIO with [kimetsu.], Guest | goosebumps.fm',
    })
    expect(head.meta).toContainEqual({
      property: 'og:title',
      content: 'FAR END RADIO with [kimetsu.], Guest | goosebumps.fm',
    })
    expect(JSON.parse(head.scripts[0]?.children ?? '').name).toBe('FAR END RADIO')
    expect(renderDocumentHead({ ...show, creators: [] }).meta).toContainEqual({
      title: 'FAR END RADIO | goosebumps.fm',
    })
  })

  test('does not invent image dimensions or audio MIME types', () => {
    const head = renderDocumentHead({
      ...metadata,
      kind: 'track',
      image: { ...metadata.image, width: null, height: null },
      audio: { url: 'https://audio.example.com/track', mimeType: null },
    })

    expect(head.meta).not.toContainEqual(expect.objectContaining({ property: 'og:image:width' }))
    expect(head.meta).not.toContainEqual(expect.objectContaining({ property: 'og:audio:type' }))
    expect(head.meta).toContainEqual({
      property: 'og:audio',
      content: 'https://audio.example.com/track',
    })
  })

  test('identifies gbfm as the alternative site name on the homepage', () => {
    const home = getStaticSiteMetadata('/')

    if (!home) throw new Error('Missing homepage metadata')
    const head = renderDocumentHead(home)

    expect(head.meta).toContainEqual({
      title: 'goosebumps.fm (gbfm) — Independent Radio & DJ Mixes',
    })
    expect(head.meta).toContainEqual({
      name: 'description',
      content:
        'Discover curated music mixes, tracks, and releases. Your destination for ambient, bass, drywall, jazz and a wide variety of sounds.',
    })
    expect(JSON.parse(head.scripts[0]?.children ?? '')).toMatchObject({
      '@type': 'WebPage',
      isPartOf: {
        '@type': 'WebSite',
        name: 'goosebumps.fm',
        alternateName: 'gbfm',
        url: 'https://goosebumps.fm/',
      },
    })
  })

  test('mix search titles and descriptions identify artists without renaming recordings', () => {
    const input = {
      slug: 'signal-arrives',
      title: 'SIGNAL ARRIVES',
      description: 'A listening document.',
      imageUrl: null,
      creators: ['[kimetsu.]', 'Guest'],
      publishedAt: null,
      modifiedAt: null,
      audioUrl: 'https://audio.example.com/signal-arrives.mp3',
    }

    const mix = makeAudioSiteMetadata({ ...input, kind: 'mix' })
    const head = renderDocumentHead(mix)

    expect(head.meta).toContainEqual({
      title: '[kimetsu.], Guest — SIGNAL ARRIVES (DJ Mix) | goosebumps.fm',
    })
    expect(mix.description).toBe(
      '[kimetsu.], Guest — SIGNAL ARRIVES. Listen to the DJ mix on goosebumps.fm (gbfm). A listening document.',
    )
    expect(JSON.parse(head.scripts[0]?.children ?? '')).toMatchObject({
      name: 'SIGNAL ARRIVES',
      byArtist: [{ name: '[kimetsu.]' }, { name: 'Guest' }],
    })

    const anonymous = makeAudioSiteMetadata({
      ...input,
      kind: 'mix',
      creators: [],
      description: null,
    })

    expect(renderDocumentHead(anonymous).meta).toContainEqual({
      title: 'SIGNAL ARRIVES (DJ Mix) | goosebumps.fm',
    })
    expect(anonymous.description).toBe(
      'SIGNAL ARRIVES. Listen to the DJ mix on goosebumps.fm (gbfm).',
    )
    const track = makeAudioSiteMetadata({ ...input, kind: 'track' })
    expect(track.description).toBe('A listening document.')
    expect(renderDocumentHead(track).meta).toContainEqual({
      title: 'SIGNAL ARRIVES | goosebumps.fm',
    })
  })

  test('profile search descriptions use the artist bio with a fallback for empty bios', () => {
    const input = {
      slug: 'kimetsu',
      title: '[kimetsu.]',
      description: 'A Johannesburg-based sonic and visual artist from Ivory Park.',
      imageUrl: null,
      publishedAt: null,
      contributionCount: 3,
    }

    expect(makeProfileSiteMetadata(input).description).toBe(input.description)
    expect(makeProfileSiteMetadata({ ...input, description: null }).description).toBe(
      '[kimetsu.] has 3 contributions on goosebumps.fm',
    )
  })

  test('centralizes content fallbacks and canonical paths', () => {
    const audio = makeAudioSiteMetadata({
      kind: 'track',
      slug: 'deep-cut',
      title: null,
      description: null,
      imageUrl: null,
      creators: [],
      publishedAt: null,
      modifiedAt: null,
      audioUrl: 'https://audio.example.com/deep-cut.mp3',
    })

    expect(audio).toMatchObject({
      title: 'deep-cut',
      description: 'Listen to deep-cut on goosebumps.fm',
      canonicalUrl: 'https://goosebumps.fm/tracks/deep-cut',
      image: { url: SITE_DEFAULT_IMAGE, width: 1200, height: 630 },
    })
  })

  test('provides edge-safe metadata for exact static and tag pages', () => {
    expect(getStaticSiteMetadata('/labels/')?.canonicalUrl).toBe('https://goosebumps.fm/labels')
    expect(getStaticSiteMetadata('/tags/deep%20house')).toEqual(
      makeStaticSiteMetadata(
        '#deep house',
        'Posts tagged #deep house on goosebumps.fm',
        '/tags/deep%20house',
      ),
    )
    expect(getStaticSiteMetadata('/dashboard')).toBeNull()
  })
})
