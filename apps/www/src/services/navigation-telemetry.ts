import type { NavigationTimingInput } from '@gbfm/api/telemetry'
import { API_ORIGIN } from '@/lib/api-origin'

const DYNAMIC_ROUTE_PREFIXES = new Set([
  'editorial',
  'labels',
  'mixes',
  'profile',
  'releases',
  'shows',
  'tags',
  'tracks',
  'tweet'
])
const STATIC_ROUTES = new Set([
  '/',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/auth/sign-in',
  '/auth/sign-up',
  '/auth/verify-email',
  '/changelog',
  '/dashboard',
  '/dashboard/admin',
  '/dashboard/all',
  '/dashboard/all/editorial',
  '/dashboard/all/mixes',
  '/dashboard/all/tweets',
  '/dashboard/appearance',
  '/dashboard/content',
  '/dashboard/content/editorial',
  '/dashboard/content/mixes',
  '/dashboard/content/tweets',
  '/dashboard/email',
  '/dashboard/email-logs',
  '/dashboard/frontend-errors',
  '/dashboard/integrations',
  '/dashboard/music',
  '/dashboard/newsletter',
  '/dashboard/overview',
  '/dashboard/player',
  '/dashboard/playlists',
  '/dashboard/profile',
  '/dashboard/search',
  '/dashboard/sessions',
  '/dashboard/shows',
  '/dashboard/users',
  '/djs',
  '/editorial',
  '/invite/charlie3000',
  '/labels',
  '/mix-upload',
  '/mixes',
  '/new',
  '/new/editorial',
  '/new/tweet',
  '/privacy',
  '/reminders',
  '/shows',
  '/spotify/callback',
  '/subscribe',
  '/tags',
  '/terms',
  '/tweet',
  '/tweet/latest',
  '/tweet/new',
  '/tweets',
  '/unsubscribe'
])
const NAVIGATION_TIMEOUT_MS = 30_000

interface ActiveNavigation {
  readonly fromRoute: string
  readonly toRoute: string
  readonly navigationType: string
  readonly direction: string
  readonly startedAt: number
  preparationFinishedAt: number | undefined
  swapStartedAt: number | undefined
  swapFinishedAt: number | undefined
  timeout: ReturnType<typeof setTimeout> | undefined
}

let activeNavigation: ActiveNavigation | undefined
let installed = false

function sendNavigationTiming(payload: NavigationTimingInput): void {
  void fetch(new URL('/api/telemetry/navigation', API_ORIGIN), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
    keepalive: true
  }).catch(() => undefined)
}

/** Converts a URL to a bounded route name suitable for telemetry. */
export function navigationRoute(url: URL): string {
  const { pathname } = url
  if (pathname === '/' && url.searchParams.has('show')) return '/?show=:slug'

  const segments = pathname.split('/').filter(Boolean)
  const first = segments[0]
  if (first === undefined) return '/'
  if (first === 'dashboard' && segments[1] === 'music-entity' && segments.length >= 4) {
    return '/dashboard/music-entity/:entityType/:id'
  }
  if (STATIC_ROUTES.has(pathname)) return pathname
  if (DYNAMIC_ROUTE_PREFIXES.has(first) && segments.length >= 2) return `/${first}/:slug`
  return segments.length === 1 ? '/:slug' : '/:path'
}

function finishNavigation(
  navigation: ActiveNavigation,
  status: 'ok' | 'cancelled' | 'timeout'
): void {
  if (activeNavigation !== navigation) return

  if (navigation.timeout !== undefined) clearTimeout(navigation.timeout)
  const finishedAt = performance.now()
  const swapStartedAt = navigation.swapStartedAt ?? navigation.preparationFinishedAt
  sendNavigationTiming({
    fromRoute: navigation.fromRoute,
    toRoute: navigation.toRoute,
    navigationType: navigation.navigationType,
    direction: navigation.direction,
    status,
    preparationMs:
      navigation.preparationFinishedAt === undefined
        ? undefined
        : navigation.preparationFinishedAt - navigation.startedAt,
    swapMs:
      navigation.swapFinishedAt === undefined || swapStartedAt === undefined
        ? undefined
        : navigation.swapFinishedAt - swapStartedAt,
    pageLoadMs:
      navigation.swapFinishedAt === undefined ? undefined : finishedAt - navigation.swapFinishedAt,
    totalMs: finishedAt - navigation.startedAt
  })
  activeNavigation = undefined
}

function onBeforePreparation(event: DocumentEventMap['astro:before-preparation']): void {
  if (activeNavigation !== undefined) finishNavigation(activeNavigation, 'cancelled')

  const startedAt = performance.now()
  const navigation: ActiveNavigation = {
    fromRoute: navigationRoute(event.from),
    toRoute: navigationRoute(event.to),
    navigationType: event.navigationType,
    direction: event.direction,
    startedAt,
    preparationFinishedAt: undefined,
    swapStartedAt: undefined,
    swapFinishedAt: undefined,
    timeout: undefined
  }
  activeNavigation = navigation
  navigation.timeout = setTimeout(
    () => finishNavigation(navigation, 'timeout'),
    NAVIGATION_TIMEOUT_MS
  )
  event.signal.addEventListener('abort', () => finishNavigation(navigation, 'cancelled'), {
    once: true
  })
}

function onAfterPreparation(): void {
  const navigation = activeNavigation
  if (navigation === undefined) return
  navigation.preparationFinishedAt = performance.now()
}

function onBeforeSwap(): void {
  const navigation = activeNavigation
  if (navigation === undefined) return
  navigation.swapStartedAt = performance.now()
}

function onAfterSwap(): void {
  const navigation = activeNavigation
  if (navigation === undefined) return
  navigation.swapFinishedAt = performance.now()
}

/** Installs one process-wide observer for Astro client-navigation timings. */
export function installNavigationTelemetry(): void {
  if (installed) return
  installed = true

  document.addEventListener('astro:before-preparation', onBeforePreparation)
  document.addEventListener('astro:after-preparation', onAfterPreparation)
  document.addEventListener('astro:before-swap', onBeforeSwap)
  document.addEventListener('astro:after-swap', onAfterSwap)
  document.addEventListener('astro:page-load', () => {
    if (activeNavigation !== undefined) finishNavigation(activeNavigation, 'ok')
  })
}
