import { Toaster } from '@gbfm/ui'
import { FPSMeter } from '@overengineering/fps-meter'
import { QueryClientProvider } from '@tanstack/react-query'
import { createRootRouteWithContext, HeadContent, Outlet } from '@tanstack/react-router'
import { lazy, Suspense } from 'react'
import { VerifyEmailBanner } from '@/components/Auth/VerifyEmailBanner'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import AppShell from '@/components/Layout/AppShell'
import { OfflineBanner } from '@/components/OfflineBanner'
import { SpotifyConnectionProvider } from '@/components/spotify/SpotifyConnectionProvider'
import { ThemeProvider } from '@/components/ThemeProvider'
import { env } from '@/env'
import { queryClient } from '@/lib/query-client'

const AuthPromptDialog = lazy(() =>
  import('@/components/AuthPromptDialog').then((m) => ({ default: m.AuthPromptDialog }))
)
const WelcomeModal = lazy(() =>
  import('@/components/onboarding/WelcomeModal').then((m) => ({ default: m.WelcomeModal }))
)
export interface MyRouterContext {
  auth: {
    user: {
      id: string
      name: string
      email: string
      role?: string | null
      image?: string | null
    } | null
    isAuthenticated: boolean
  }
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8'
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1'
      },
      {
        title: 'goosebumps.fm'
      }
    ]
  }),
  component: () => (
    <>
      <HeadContent />
      <ErrorBoundary>
        <ThemeProvider>
          <QueryClientProvider client={queryClient}>
            <SpotifyConnectionProvider>
              <AppShell showFooter={location.pathname !== '/'}>
                {env.isDev && (
                  <FPSMeter className='fixed top-0 right-0 z-50 hidden sm:block' height={40} />
                )}
                <OfflineBanner />
                <VerifyEmailBanner />
                <Suspense fallback={null}>
                  <WelcomeModal />
                  <AuthPromptDialog />
                </Suspense>
                <Outlet />
              </AppShell>
            </SpotifyConnectionProvider>
          </QueryClientProvider>
        </ThemeProvider>
      </ErrorBoundary>
      <Toaster viewportClassName='lg:bottom-12' />
      <Suspense>{/* <TanStackRouterDevtools position="" /> */}</Suspense>
    </>
  )
})
