import * as Sentry from '@sentry/react'
import { traceSampleRate } from '@gbfm/core/observability/trace-sampling'
import { QueryClientProvider } from '@tanstack/react-query'
import { createRouter, RouterProvider } from '@tanstack/react-router'
import { Loader2 } from 'lucide-react'
import { Schema } from 'effect'
import React from 'react'
import { createRoot } from 'react-dom/client'
import { env } from '@/env'
import { RuntimeClient } from '@/runtime'
import { page } from '@/services/analytics'

import { MAIN_SCROLL_CONTAINER_ID } from './lib/constants'
import { queryClient } from './lib/query-client'
import { routeTree } from './routeTree.gen'
import './styles/main.css'
import { ThemeProvider } from './components/ThemeProvider'
import { PlayerProvider } from './services/player'
import { useSession } from './lib/auth-client'

function RoutePending() {
  return (
    <div
      role='status'
      aria-live='polite'
      className='pointer-events-none fixed bottom-20 left-1/2 z-40 flex min-h-8 -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-md border border-border/60 bg-background/95 px-3 py-1.5 font-mono text-xs text-muted-foreground shadow-lg backdrop-blur-sm'>
      <Loader2 aria-hidden className='h-3.5 w-3.5 motion-safe:animate-spin' />
      Loading…
    </div>
  )
}

const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
  defaultPendingComponent: RoutePending,
  defaultPendingMs: 100,
  defaultPendingMinMs: 300,
  defaultViewTransition: true,
  scrollRestoration: true,
  scrollToTopSelectors: [() => document.getElementById(MAIN_SCROLL_CONTAINER_ID)],
  context: {
    auth: {
      user: null,
      isAuthenticated: false
    }
  }
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

type SentryUrlCandidate =
  | NonNullable<Sentry.Event['request']>['url']
  | NonNullable<Sentry.Event['spans']>[number]['data'][string]

const isLocalUrl = (value: SentryUrlCandidate) =>
  Schema.is(Schema.String)(value) && (value.includes('127.0.0.1') || value.includes('localhost'))

const hasLocalUrl = (event: Sentry.Event) =>
  isLocalUrl(event.request?.url) ||
  event.spans?.some((span) => isLocalUrl(span.description) || isLocalUrl(span.data?.url))

const tracePropagationTargets = env.isDev
  ? [/^\//, 'http://127.0.0.1:3003', 'http://localhost:3003']
  : [/^\//, 'https://goosebumps.fm', 'https://www.goosebumps.fm', 'https://vps.goosebumps.fm']

if (env.sentryDsn && (!env.isDev || env.sentryEnableLocal)) {
  Sentry.init({
    dsn: env.sentryDsn,
    environment: env.sentryEnvironment ?? (env.isDev ? 'development' : 'production'),
    release: env.sentryRelease,
    debug: env.isDev,
    enableLogs: true,
    integrations: [Sentry.browserTracingIntegration()],
    tracesSampler: ({ inheritOrSampleWith, location, name }) =>
      inheritOrSampleWith(
        traceSampleRate({
          name,
          url: location ? `${location.pathname}${location.search}` : undefined
        })
      ),
    tracePropagationTargets,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: env.isDev ? 0 : 1.0,
    sendDefaultPii: false,
    beforeSend: (event) => (hasLocalUrl(event) ? null : event),
    beforeSendTransaction: (event) => (hasLocalUrl(event) ? null : event)
  })

  if (!env.isDev) {
    const client = Sentry.getClient()
    Sentry.lazyLoadIntegration('replayIntegration').then(
      (replayIntegration) => {
        client?.addIntegration(
          replayIntegration({
            maskAllText: true,
            blockAllMedia: true
          })
        )
      },
      () => {
        Sentry.captureMessage('Failed to load browser replay integration', 'warning')
      }
    )
  }
}

function App() {
  const { data: session, isPending } = useSession()
  const user = session?.user ?? null
  const routerContext = React.useMemo(
    () => ({ auth: { user, isAuthenticated: Boolean(user) } }),
    [user]
  )

  React.useEffect(() => {
    void RuntimeClient.runPromise(
      page('app-loaded', {
        pathname: window.location.pathname
      })
    )
  }, [])

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme='dark' storageKey='vite-ui-theme'>
        <PlayerProvider>
          {isPending ? (
            <div className='flex min-h-dvh items-center justify-center'>
              <Loader2 className='h-6 w-6 animate-spin text-muted-foreground' />
            </div>
          ) : (
            <RouterProvider router={router} context={routerContext} />
          )}
        </PlayerProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}

const container = document.getElementById('root')

if (container) {
  const root = createRoot(container)

  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  )
} else {
  throw new Error(
    "Root element with ID 'root' was not found in the document. Ensure there is a corresponding HTML element with the ID 'root' in your HTML file."
  )
}
