import { Schema } from 'effect'

export const Route = Schema.TaggedUnion({
  Home: {},
  Listing: { kind: Schema.String },
  Detail: { kind: Schema.String, slug: Schema.String },
  Auth: { action: Schema.String },
  Composer: { kind: Schema.String },
  Dashboard: { section: Schema.String },
  Static: { page: Schema.String },
  NotFound: {},
})

export type Route = typeof Route.Type

const listingKinds = new Set([
  'mixes',
  'tracks',
  'shows',
  'editorial',
  'tweets',
  'labels',
  'releases',
  'tags',
  'djs',
])

const serverPaths = ['/rss.xml', '/sitemap.xml', '/robots.txt', '/api/', '/health', '/s/']

/** Whether a same-origin path is answered by the API rather than a Foldkit page. */
export const isServerPath = (pathname: string) =>
  serverPaths.some((path) => (path.endsWith('/') ? pathname.startsWith(path) : pathname === path))

/** Parses an application pathname into its root route. */
export const parseRoute = (pathname: string): Route => {
  let parts: Array<string>

  try {
    parts = pathname.split('/').filter(Boolean).map(decodeURIComponent)
  } catch {
    return Route.cases.NotFound.make({})
  }

  const [first = '', second] = parts

  if (!first) return Route.cases.Home.make({})

  if (first === 'dashboard')
    return Route.cases.Dashboard.make({ section: parts.slice(1).join('/') || 'favorites' })

  if (first === 'reminders') return Route.cases.Dashboard.make({ section: 'reminders' })

  if (first === 'spotify' && second === 'callback' && parts.length === 2)
    return Route.cases.Static.make({ page: 'spotify-callback' })

  if (parts.length > 2) return Route.cases.NotFound.make({})

  if (first === 'invite' && second === 'charlie3000')
    return Route.cases.Static.make({ page: 'invite/charlie3000' })

  if (
    first === 'auth' &&
    second &&
    ['sign-in', 'sign-up', 'forgot-password', 'reset-password', 'verify-email'].includes(second)
  )
    return Route.cases.Auth.make({ action: second })

  if (first === 'new') return Route.cases.Composer.make({ kind: second ?? 'chooser' })

  if (first === 'mix-upload') return Route.cases.Composer.make({ kind: 'mix' })

  if (
    ['about', 'privacy', 'terms', 'changelog', 'subscribe', 'unsubscribe'].includes(first) &&
    !second
  )
    return Route.cases.Static.make({ page: first })

  if (listingKinds.has(first))
    return second
      ? Route.cases.Detail.make({ kind: first, slug: second })
      : Route.cases.Listing.make({ kind: first })

  if (first === 'profile' && second) return Route.cases.Detail.make({ kind: first, slug: second })

  if (first === 'tweet' && second) return Route.cases.Detail.make({ kind: 'tweets', slug: second })

  if (parts.length === 1) return Route.cases.Detail.make({ kind: 'resolve', slug: first })

  return Route.cases.NotFound.make({})
}
