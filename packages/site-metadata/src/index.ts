import { Schema } from 'effect'

/** Canonical production origin used by public metadata. */
export const SITE_URL = 'https://goosebumps.fm'

/** Branded fallback image with known Open Graph dimensions. */
export const SITE_DEFAULT_IMAGE = 'https://d20tmfka7s58bt.cloudfront.net/gb-default.png'

/** Public content variants with distinct structured-data semantics. */
export const SiteMetadataKind = Schema.Literals([
  'mix',
  'track',
  'show',
  'release',
  'label',
  'profile',
  'editorial',
  'tweet',
  'page'
])

/** Runtime-safe metadata contract crossing the API-to-WWW Worker binding. */
export const SiteMetadata = Schema.Struct({
  schemaVersion: Schema.Literal(1),
  kind: SiteMetadataKind,
  title: Schema.String,
  description: Schema.String,
  canonicalUrl: Schema.String,
  image: Schema.Struct({
    url: Schema.String,
    alt: Schema.String,
    width: Schema.NullOr(Schema.Number),
    height: Schema.NullOr(Schema.Number)
  }),
  creators: Schema.Array(Schema.String),
  publishedAt: Schema.NullOr(Schema.String),
  modifiedAt: Schema.NullOr(Schema.String),
  audio: Schema.NullOr(
    Schema.Struct({
      url: Schema.String,
      mimeType: Schema.NullOr(Schema.String)
    })
  )
})

/** Parsed site metadata. */
export type SiteMetadata = typeof SiteMetadata.Type

export type HeadMeta =
  | { readonly title: string }
  | { readonly name: string; readonly content: string }
  | { readonly property: string; readonly content: string }

export interface DocumentHead {
  readonly meta: Array<HeadMeta>
  readonly links: Array<{ readonly rel: 'canonical'; readonly href: string }>
  readonly scripts: Array<{
    readonly type: 'application/ld+json'
    readonly children: string
  }>
}

const titleWithSite = (title: string) =>
  title === 'goosebumps.fm' ? title : `${title} | goosebumps.fm`

const openGraphType = (kind: SiteMetadata['kind']) => {
  if (kind === 'mix' || kind === 'track') return 'music.song'
  if (kind === 'release') return 'music.album'
  if (kind === 'profile') return 'profile'
  if (kind === 'editorial' || kind === 'tweet') return 'article'
  return 'website'
}

const jsonLdFor = (metadata: SiteMetadata) => {
  const base = {
    '@context': 'https://schema.org',
    name: metadata.title,
    description: metadata.description,
    image: metadata.image.url,
    url: metadata.canonicalUrl
  }
  if (metadata.kind === 'mix' || metadata.kind === 'track') {
    return {
      ...base,
      '@type': 'MusicRecording',
      ...(metadata.creators.length > 0
        ? {
            byArtist: metadata.creators.map((name) => ({ '@type': 'Person', name }))
          }
        : undefined),
      ...(metadata.audio
        ? { audio: { '@type': 'AudioObject', contentUrl: metadata.audio.url } }
        : undefined)
    }
  }
  if (metadata.kind === 'release') {
    return {
      ...base,
      '@type': 'MusicAlbum',
      ...(metadata.creators.length > 0
        ? { byArtist: metadata.creators.map((name) => ({ '@type': 'MusicGroup', name })) }
        : undefined)
    }
  }
  if (metadata.kind === 'editorial' || metadata.kind === 'tweet') {
    return {
      ...base,
      '@type': 'Article',
      headline: metadata.title,
      publisher: { '@type': 'Organization', name: 'goosebumps.fm', url: SITE_URL },
      ...(metadata.creators.length > 0
        ? { author: metadata.creators.map((name) => ({ '@type': 'Person', name })) }
        : undefined),
      ...(metadata.publishedAt ? { datePublished: metadata.publishedAt } : undefined),
      ...(metadata.modifiedAt ? { dateModified: metadata.modifiedAt } : undefined)
    }
  }
  if (metadata.kind === 'profile') return { ...base, '@type': 'Person' }
  return {
    ...base,
    '@type': 'WebPage',
    isPartOf: { '@type': 'WebSite', name: 'goosebumps.fm', url: SITE_URL }
  }
}

/** Projects the canonical model into framework-neutral head entries. */
export const renderDocumentHead = (metadata: SiteMetadata): DocumentHead => {
  const title = titleWithSite(metadata.title)
  const meta: Array<HeadMeta> = [
    { title },
    { name: 'description', content: metadata.description },
    { property: 'og:type', content: openGraphType(metadata.kind) },
    { property: 'og:title', content: title },
    { property: 'og:description', content: metadata.description },
    { property: 'og:url', content: metadata.canonicalUrl },
    { property: 'og:site_name', content: 'goosebumps.fm' },
    { property: 'og:image', content: metadata.image.url },
    { property: 'og:image:alt', content: metadata.image.alt },
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:site', content: '@goosebumpsfm' },
    { name: 'twitter:title', content: title },
    { name: 'twitter:description', content: metadata.description },
    { name: 'twitter:image', content: metadata.image.url },
    { name: 'twitter:image:alt', content: metadata.image.alt }
  ]
  if (metadata.image.width !== null) {
    meta.push({ property: 'og:image:width', content: String(metadata.image.width) })
  }
  if (metadata.image.height !== null) {
    meta.push({ property: 'og:image:height', content: String(metadata.image.height) })
  }
  if (metadata.audio) {
    meta.push({ property: 'og:audio', content: metadata.audio.url })
    if (metadata.audio.mimeType) {
      meta.push({ property: 'og:audio:type', content: metadata.audio.mimeType })
    }
  }
  if (metadata.publishedAt && (metadata.kind === 'editorial' || metadata.kind === 'tweet')) {
    meta.push({ property: 'article:published_time', content: metadata.publishedAt })
  }
  if (metadata.modifiedAt && (metadata.kind === 'editorial' || metadata.kind === 'tweet')) {
    meta.push({ property: 'article:modified_time', content: metadata.modifiedAt })
  }
  return {
    meta,
    links: [{ rel: 'canonical', href: metadata.canonicalUrl }],
    scripts: [{ type: 'application/ld+json', children: JSON.stringify(jsonLdFor(metadata)) }]
  }
}

const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[character] ??
      character
  )

/** Renders safe HTML tags for edge insertion and share documents. */
export const renderMetadataHtml = (metadata: SiteMetadata) => {
  const head = renderDocumentHead(metadata)
  const tags = head.meta.map((entry) => {
    if ('title' in entry) return `<title>${escapeHtml(entry.title)}</title>`
    if ('property' in entry) {
      return `<meta property="${entry.property}" content="${escapeHtml(entry.content)}">`
    }
    return `<meta name="${entry.name}" content="${escapeHtml(entry.content)}">`
  })
  tags.push(...head.links.map((link) => `<link rel="canonical" href="${escapeHtml(link.href)}">`))
  tags.push(
    ...head.scripts.map(
      (script) =>
        `<script type="application/ld+json">${script.children.replace(/</g, String.raw`\u003c`)}</script>`
    )
  )
  return tags.join('\n    ')
}

/** Creates a complete metadata value while centralizing image fallback policy. */
export const makeSiteMetadata = (
  input: Omit<SiteMetadata, 'schemaVersion' | 'image'> & {
    readonly imageUrl: string | null
    readonly imageAlt: string
    readonly imageWidth?: number | null
    readonly imageHeight?: number | null
  }
): SiteMetadata => ({
  schemaVersion: 1,
  kind: input.kind,
  title: input.title,
  description: input.description,
  canonicalUrl: input.canonicalUrl,
  image: {
    url: input.imageUrl ?? SITE_DEFAULT_IMAGE,
    alt: input.imageAlt,
    width: input.imageUrl === null ? 1080 : (input.imageWidth ?? null),
    height: input.imageUrl === null ? 1080 : (input.imageHeight ?? null)
  },
  creators: input.creators,
  publishedAt: input.publishedAt,
  modifiedAt: input.modifiedAt,
  audio: input.audio
})

type ContentMetadataInput = {
  readonly slug: string
  readonly title: string | null
  readonly description: string | null
  readonly imageUrl: string | null
  readonly creators: ReadonlyArray<string>
  readonly publishedAt: string | null
  readonly modifiedAt: string | null
  readonly siteUrl?: string
}

const siteUrlFor = (input: { readonly siteUrl?: string }) =>
  (input.siteUrl ?? SITE_URL).replace(/\/$/, '')

/** Builds canonical metadata for a public mix or track. */
export const makeAudioSiteMetadata = (
  input: ContentMetadataInput & {
    readonly kind: 'mix' | 'track'
    readonly audioUrl: string
    readonly audioMimeType?: string | null
  }
) => {
  const title = input.title || input.slug
  return makeSiteMetadata({
    kind: input.kind,
    title,
    description: input.description || `Listen to ${title} on goosebumps.fm`,
    canonicalUrl: `${siteUrlFor(input)}/${input.kind === 'mix' ? 'mixes' : 'tracks'}/${input.slug}`,
    imageUrl: input.imageUrl,
    imageAlt: `${title} cover art`,
    creators: [...input.creators],
    publishedAt: input.publishedAt,
    modifiedAt: input.modifiedAt,
    audio: { url: input.audioUrl, mimeType: input.audioMimeType ?? null }
  })
}

/** Builds canonical metadata for a public show. */
export const makeShowSiteMetadata = (input: ContentMetadataInput) => {
  const title = input.title || input.slug
  return makeSiteMetadata({
    kind: 'show',
    title,
    description:
      input.description ||
      (input.creators.length > 0
        ? `${title} hosted by ${input.creators.join(', ')} on goosebumps.fm`
        : `Listen to ${title} on goosebumps.fm`),
    canonicalUrl: `${siteUrlFor(input)}/shows/${input.slug}`,
    imageUrl: input.imageUrl,
    imageAlt: `${title} show art`,
    creators: [...input.creators],
    publishedAt: input.publishedAt,
    modifiedAt: input.modifiedAt,
    audio: null
  })
}

/** Builds canonical metadata for a public release. */
export const makeReleaseSiteMetadata = (input: ContentMetadataInput) => {
  const title = input.title || input.slug
  return makeSiteMetadata({
    kind: 'release',
    title,
    description: input.description || `Discover ${title} on goosebumps.fm`,
    canonicalUrl: `${siteUrlFor(input)}/releases/${input.slug}`,
    imageUrl: input.imageUrl,
    imageAlt: `${title} album art`,
    creators: [...input.creators],
    publishedAt: input.publishedAt,
    modifiedAt: input.modifiedAt,
    audio: null
  })
}

/** Builds canonical metadata for a public label. */
export const makeLabelSiteMetadata = (input: ContentMetadataInput) => {
  const title = input.title || input.slug
  return makeSiteMetadata({
    kind: 'label',
    title,
    description: input.description || `Explore music from ${title} on goosebumps.fm`,
    canonicalUrl: `${siteUrlFor(input)}/labels/${input.slug}`,
    imageUrl: input.imageUrl,
    imageAlt: `${title} label art`,
    creators: [...input.creators],
    publishedAt: input.publishedAt,
    modifiedAt: input.modifiedAt,
    audio: null
  })
}

/** Builds canonical metadata for a public profile. */
export const makeProfileSiteMetadata = (
  input: Omit<ContentMetadataInput, 'description' | 'creators' | 'modifiedAt'> & {
    readonly contributionCount: number
  }
) => {
  const title = input.title || input.slug
  return makeSiteMetadata({
    kind: 'profile',
    title,
    description:
      input.contributionCount > 0
        ? `${title} has ${input.contributionCount} ${input.contributionCount === 1 ? 'contribution' : 'contributions'} on goosebumps.fm`
        : `${title}'s profile on goosebumps.fm`,
    canonicalUrl: `${siteUrlFor(input)}/${input.slug}`,
    imageUrl: input.imageUrl,
    imageAlt: `${title}'s profile picture`,
    creators: [],
    publishedAt: input.publishedAt,
    modifiedAt: null,
    audio: null
  })
}

/** Builds canonical metadata for a public editorial or tweet. */
export const makePostSiteMetadata = (
  input: ContentMetadataInput & {
    readonly kind: 'editorial' | 'tweet'
    readonly imageWidth?: number | null
    readonly imageHeight?: number | null
  }
) => {
  const title = input.title || input.slug
  return makeSiteMetadata({
    kind: input.kind,
    title,
    description: input.description || `Read ${title} on goosebumps.fm`,
    canonicalUrl: `${siteUrlFor(input)}/${input.kind}/${input.slug}`,
    imageUrl: input.imageUrl,
    imageAlt: `${title} on goosebumps.fm`,
    imageWidth: input.imageWidth ?? null,
    imageHeight: input.imageHeight ?? null,
    creators: [...input.creators],
    publishedAt: input.publishedAt,
    modifiedAt: input.modifiedAt,
    audio: null
  })
}

/** Builds canonical metadata for a public static page. */
export const makeStaticSiteMetadata = (title: string, description: string, path: string) =>
  makeSiteMetadata({
    kind: 'page',
    title,
    description,
    canonicalUrl: `${SITE_URL}${path}`,
    imageUrl: null,
    imageAlt: `${title} on goosebumps.fm`,
    creators: [],
    publishedAt: null,
    modifiedAt: null,
    audio: null
  })

/** Shared metadata for public pages that do not require server data. */
export const STATIC_SITE_METADATA = {
  home: makeStaticSiteMetadata(
    'goosebumps.fm',
    'Discover curated music mixes, tracks, and releases. Your destination for deep house, electronic, and soulful sounds.',
    '/'
  ),
  labels: makeStaticSiteMetadata(
    'Record Labels',
    'Discover independent record labels and their music catalogs on goosebumps.fm.',
    '/labels'
  ),
  shows: makeStaticSiteMetadata(
    'Radio Shows',
    'Discover radio shows and residencies on goosebumps.fm. Subscribe to get notified of new episodes.',
    '/shows'
  ),
  editorial: makeStaticSiteMetadata(
    'Editorial',
    'Long-form posts, essays, and deep dives on goosebumps.fm.',
    '/editorial'
  ),
  djs: makeStaticSiteMetadata(
    'DJs & Residents',
    'Browse the DJs and residents who have published mixes on goosebumps.fm.',
    '/djs'
  ),
  tags: makeStaticSiteMetadata('Tags', 'Browse posts by tag on goosebumps.fm', '/tags'),
  changelog: makeStaticSiteMetadata(
    'Changelog',
    'Latest updates and fixes from goosebumps.fm.',
    '/changelog'
  ),
  privacy: makeStaticSiteMetadata(
    'Privacy Policy',
    'Privacy information for goosebumps.fm.',
    '/privacy'
  ),
  terms: makeStaticSiteMetadata(
    'Terms of Service',
    'Terms of service for goosebumps.fm.',
    '/terms'
  ),
  subscribe: makeStaticSiteMetadata(
    'Newsletter',
    'Get notified when new mixes and updates land on goosebumps.fm.',
    '/subscribe'
  ),
  inviteCharlie3000: makeStaticSiteMetadata(
    'An invite for Charlie3000',
    'A personal invitation to Charlie3000 to record a guest mix for goosebumps.fm',
    '/invite/charlie3000'
  )
} as const

const staticMetadataByPath = new Map<string, SiteMetadata>([
  ['/', STATIC_SITE_METADATA.home],
  ['/labels', STATIC_SITE_METADATA.labels],
  ['/shows', STATIC_SITE_METADATA.shows],
  ['/editorial', STATIC_SITE_METADATA.editorial],
  ['/djs', STATIC_SITE_METADATA.djs],
  ['/tags', STATIC_SITE_METADATA.tags],
  ['/changelog', STATIC_SITE_METADATA.changelog],
  ['/privacy', STATIC_SITE_METADATA.privacy],
  ['/terms', STATIC_SITE_METADATA.terms],
  ['/subscribe', STATIC_SITE_METADATA.subscribe],
  ['/invite/charlie3000', STATIC_SITE_METADATA.inviteCharlie3000]
])

/** Returns shared metadata for an exact public static path. */
export const getStaticSiteMetadata = (pathname: string) => {
  const normalizedPath = pathname.replace(/\/$/, '') || '/'
  const metadata = staticMetadataByPath.get(normalizedPath)
  if (metadata) return metadata

  const tagMatch = /^\/tags\/([^/]+)$/.exec(normalizedPath)
  if (!tagMatch?.[1]) return null
  try {
    const tag = decodeURIComponent(tagMatch[1])
    return makeStaticSiteMetadata(
      `#${tag}`,
      `Posts tagged #${tag} on goosebumps.fm`,
      `/tags/${encodeURIComponent(tag)}`
    )
  } catch {
    return null
  }
}
