import * as Sentry from '@sentry/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createRouter, RouterProvider } from '@tanstack/react-router'
import React from 'react'
import { createRoot } from 'react-dom/client'
import { env } from '@/env'
import { RuntimeClient } from '@/runtime'
import { page } from '@/services/analytics'

import { MAIN_SCROLL_CONTAINER_ID } from './lib/constants'
import { routeTree } from './routeTree.gen'
import './styles/main.css'
import { ThemeProvider } from './components/ThemeProvider'
import { useSession } from './lib/auth-client'

const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
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

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5
    }
  }
})

const isLocalUrl = (value: unknown) =>
  typeof value === 'string' && (value.includes('127.0.0.1') || value.includes('localhost'))

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
    integrations: [
      Sentry.browserTracingIntegration(),
      ...(env.isDev
        ? []
        : [
            Sentry.replayIntegration({
              maskAllText: false,
              blockAllMedia: false
            })
          ])
    ],
    tracesSampleRate: 1.0,
    tracePropagationTargets,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: env.isDev ? 0 : 1.0,
    sendDefaultPii: false,
    beforeSend: (event) => (hasLocalUrl(event) ? null : event),
    beforeSendTransaction: (event) => (hasLocalUrl(event) ? null : event)
  })
}

function App() {
  const { data: session } = useSession()
  const auth = {
    user: session?.user ?? null,
    isAuthenticated: Boolean(session?.user)
  }

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
        <RouterProvider router={router} context={{ auth }} />
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
