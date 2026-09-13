import { Schema } from 'effect'
import { DEFAULT_OG_IMAGE, generateMicroPostSEO } from './lib/seo'

type Fetcher = {
  readonly fetch: (request: Request) => Promise<Response>
}

export interface SeoWorkerEnv {
  readonly API: Fetcher
  readonly ASSETS: Fetcher
}

const TweetMetadataSource = Schema.Struct({
  title: Schema.NullOr(Schema.String),
  description: Schema.NullOr(Schema.String),
  thumbnailUrl: Schema.NullOr(Schema.String),
  slug: Schema.String,
  createdAt: Schema.String,
  updatedAt: Schema.String,
  creators: Schema.optional(Schema.Array(Schema.Struct({ name: Schema.String })))
})

type TweetMetadataSource = typeof TweetMetadataSource.Type

const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
      })[character] ?? character
  )

const renderTweetHead = (post: TweetMetadataSource, slug: string) => {
  const seo = generateMicroPostSEO(post, slug)
  const title = `${seo.title} | goosebumps.fm`
  const image = seo.image ?? DEFAULT_OG_IMAGE
  const authors = post.creators?.map((creator) => creator.name) ?? []
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: seo.title,
    description: seo.description,
    image,
    url: seo.url,
    datePublished: post.createdAt,
    dateModified: post.updatedAt,
    publisher: {
      '@type': 'Organization',
      name: 'goosebumps.fm',
      url: 'https://goosebumps.fm'
    },
    ...(authors.length > 0
      ? { author: authors.map((name) => ({ '@type': 'Person', name })) }
      : undefined)
  }
  const safeJsonLd = JSON.stringify(jsonLd).replace(/</g, String.raw`\u003c`)
  const meta = (attribute: 'name' | 'property', key: string, content: string) =>
    `<meta ${attribute}="${key}" content="${escapeHtml(content)}" data-gbfm-edge-seo>`

  return [
    `<title data-gbfm-edge-seo>${escapeHtml(title)}</title>`,
    meta('name', 'description', seo.description),
    meta('property', 'og:type', 'article'),
    meta('property', 'og:title', title),
    meta('property', 'og:description', seo.description),
    meta('property', 'og:url', seo.url),
    meta('property', 'og:site_name', 'goosebumps.fm'),
    meta('property', 'og:image', image),
    meta('property', 'og:image:alt', `${seo.title} thumbnail`),
    meta('property', 'article:published_time', post.createdAt),
    meta('property', 'article:modified_time', post.updatedAt),
    ...authors.map((author) => meta('property', 'article:author', author)),
    meta('name', 'twitter:card', 'summary_large_image'),
    meta('name', 'twitter:title', title),
    meta('name', 'twitter:description', seo.description),
    meta('name', 'twitter:image', image),
    meta('name', 'twitter:image:alt', `${seo.title} thumbnail`),
    `<link rel="canonical" href="${escapeHtml(seo.url)}" data-gbfm-edge-seo>`,
    `<script type="application/ld+json" data-gbfm-edge-seo>${safeJsonLd}</script>`
  ].join('\n    ')
}

const injectHead = (html: string, head: string) => {
  const withoutDefaultTitle = html.replace(/\s*<title>goosebumps\.fm<\/title>/i, '')
  return withoutDefaultTitle.replace('</head>', `    ${head}\n  </head>`)
}

const tweetSlug = (pathname: string) => /^\/tweet\/([^/]+)\/?$/.exec(pathname)?.[1]

export const handleRequest = async (request: Request, env: SeoWorkerEnv): Promise<Response> => {
  const slug = request.method === 'GET' ? tweetSlug(new URL(request.url).pathname) : undefined
  const assetResponse = await env.ASSETS.fetch(request)
  if (!slug || !assetResponse.ok) return assetResponse
  const fallbackResponse = assetResponse.clone()

  try {
    const apiResponse = await env.API.fetch(
      new Request(`https://api.internal/api/content/posts/micro/${slug}`)
    )
    if (!apiResponse.ok) return assetResponse

    const post = Schema.decodeUnknownSync(TweetMetadataSource)(await apiResponse.json())
    const html = injectHead(await assetResponse.text(), renderTweetHead(post, post.slug))
    const headers = new Headers(assetResponse.headers)
    headers.delete('content-length')
    headers.delete('content-encoding')
    headers.set('content-type', 'text/html; charset=utf-8')

    return new Response(html, { status: assetResponse.status, headers })
  } catch {
    return fallbackResponse
  }
}

export default {
  fetch: handleRequest
}
