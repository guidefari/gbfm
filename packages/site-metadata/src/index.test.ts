import { describe, expect, test } from 'vitest'
import {
  getStaticSiteMetadata,
  makeAudioSiteMetadata,
  makeStaticSiteMetadata,
  renderDocumentHead,
  renderMetadataHtml,
  SITE_DEFAULT_IMAGE,
  type SiteMetadata
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
    height: 630
  },
  creators: ['Guide Fari'],
  publishedAt: '2026-09-01T00:00:00.000Z',
  modifiedAt: '2026-09-12T00:00:00.000Z',
  audio: null
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
      datePublished: metadata.publishedAt
    })
  })

  test('escapes HTML while preserving JSON-LD content', () => {
    const html = renderMetadataHtml(metadata)

    expect(html).toContain('<title>A &lt;strange&gt; &amp; useful post | goosebumps.fm</title>')
    expect(html).not.toContain('<strange>')
    expect(html).toContain('A \\u003cstrange> & useful post')
  })

  test('does not invent image dimensions or audio MIME types', () => {
    const head = renderDocumentHead({
      ...metadata,
      kind: 'track',
      image: { ...metadata.image, width: null, height: null },
      audio: { url: 'https://audio.example.com/track', mimeType: null }
    })

    expect(head.meta).not.toContainEqual(expect.objectContaining({ property: 'og:image:width' }))
    expect(head.meta).not.toContainEqual(expect.objectContaining({ property: 'og:audio:type' }))
    expect(head.meta).toContainEqual({
      property: 'og:audio',
      content: 'https://audio.example.com/track'
    })
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
      audioUrl: 'https://audio.example.com/deep-cut.mp3'
    })

    expect(audio).toMatchObject({
      title: 'deep-cut',
      description: 'Listen to deep-cut on goosebumps.fm',
      canonicalUrl: 'https://goosebumps.fm/tracks/deep-cut',
      image: { url: SITE_DEFAULT_IMAGE, width: 1080, height: 1080 }
    })
  })

  test('provides edge-safe metadata for exact static and tag pages', () => {
    expect(getStaticSiteMetadata('/labels/')?.canonicalUrl).toBe('https://goosebumps.fm/labels')
    expect(getStaticSiteMetadata('/tags/deep%20house')).toEqual(
      makeStaticSiteMetadata(
        '#deep house',
        'Posts tagged #deep house on goosebumps.fm',
        '/tags/deep%20house'
      )
    )
    expect(getStaticSiteMetadata('/dashboard')).toBeNull()
  })
})
