import { Schema } from 'effect'
import { getStaticSiteMetadata, renderMetadataHtml, SiteMetadata } from '@gbfm/site-metadata'

type Fetcher = {
  readonly fetch: (request: Request) => Promise<Response>
}

type WorkerExecutionContext = {
  readonly waitUntil: (promise: Promise<unknown>) => void
}

export interface SeoWorkerEnv {
  readonly API: Fetcher
  readonly ASSETS: Fetcher
  readonly SOCIAL_IMAGES: Fetcher
}

type MetadataRoute = {
  readonly kind:
    | 'mix'
    | 'track'
    | 'show'
    | 'release'
    | 'label'
    | 'profile'
    | 'editorial'
    | 'tweet'
    | 'slug'
  readonly slug: string
}

const decodeMetadata = Schema.decodeUnknownSync(SiteMetadata)

const reservedTopLevelRoutes = new Set([
  'auth',
  'changelog',
  'dashboard',
  'djs',
  'editorial',
  'invite',
  'labels',
  'mix-upload',
  'mixes',
  'new',
  'privacy',
  'profile',
  'releases',
  'reminders',
  'shows',
  'spotify',
  'subscribe',
  'tags',
  'terms',
  'tracks',
  'tweet',
  'tweets',
  'unsubscribe'
])

const metadataKind = (segment: string): MetadataRoute['kind'] | null => {
  switch (segment) {
    case 'mixes':
      return 'mix'
    case 'tracks':
      return 'track'
    case 'shows':
      return 'show'
    case 'releases':
      return 'release'
    case 'labels':
      return 'label'
    case 'profile':
      return 'profile'
    case 'editorial':
      return 'editorial'
    case 'tweet':
      return 'tweet'
    default:
      return null
  }
}

const metadataRoute = (pathname: string): MetadataRoute | null => {
  const segments = pathname.split('/').filter(Boolean)
  if (segments.length === 1 && segments[0] && !reservedTopLevelRoutes.has(segments[0])) {
    return { kind: 'slug', slug: segments[0] }
  }
  if (segments.length !== 2 || !segments[1]) return null
  if (segments[0] === 'tweet' && (segments[1] === 'latest' || segments[1] === 'new')) return null

  const kind = metadataKind(segments[0] ?? '')
  return kind ? { kind, slug: segments[1] } : null
}

const injectHead = (html: string, head: string) => {
  const withoutDefaultTitle = html.replace(/\s*<title>goosebumps\.fm<\/title>/i, '')
  return withoutDefaultTitle.replace('</head>', `    ${head}\n  </head>`)
}

const noindexHtml = (html: string) =>
  injectHead(html, '<meta name="robots" content="noindex, nofollow">')

const htmlResponse = async (source: Response, html: string, status = source.status) => {
  const headers = new Headers(source.headers)
  headers.delete('content-length')
  headers.delete('content-encoding')
  headers.set('content-type', 'text/html; charset=utf-8')
  return new Response(html, { status, headers })
}

/** Injects canonical metadata into every public dynamic SPA document. */
export const handleRequest = async (request: Request, env: SeoWorkerEnv): Promise<Response> => {
  const pathname = new URL(request.url).pathname
  if (pathname === '/sitemap.xml') return env.API.fetch(request)
  if (pathname.startsWith('/social/tweets/')) return env.SOCIAL_IMAGES.fetch(request)

  const assetResponse = await env.ASSETS.fetch(request)
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return assetResponse
  }
  if (!assetResponse.headers.get('content-type')?.startsWith('text/html')) return assetResponse

  const staticMetadata = getStaticSiteMetadata(pathname)
  if (staticMetadata) {
    const html = injectHead(await assetResponse.text(), renderMetadataHtml(staticMetadata))
    return htmlResponse(assetResponse, request.method === 'HEAD' ? '' : html)
  }

  const route = metadataRoute(pathname)
  if (!route || !assetResponse.ok) return assetResponse
  const fallbackResponse = assetResponse.clone()

  try {
    const apiResponse = await env.API.fetch(
      new Request(
        `https://api.internal/api/site-metadata/${route.kind}/${encodeURIComponent(route.slug)}`
      )
    )
    if (apiResponse.status === 404) {
      const html = noindexHtml(await assetResponse.text())
      return htmlResponse(assetResponse, request.method === 'HEAD' ? '' : html, 404)
    }
    if (!apiResponse.ok) return fallbackResponse

    const metadata = decodeMetadata(await apiResponse.json())
    const html = injectHead(await assetResponse.text(), renderMetadataHtml(metadata))
    return htmlResponse(assetResponse, request.method === 'HEAD' ? '' : html)
  } catch (error) {
    console.error('site metadata injection failed', {
      path: pathname,
      errorName: error instanceof Error ? error.name : 'UnknownError'
    })
    return fallbackResponse
  }
}

export default {
  fetch: (request: Request, env: SeoWorkerEnv, _context: WorkerExecutionContext) =>
    handleRequest(request, env)
}
