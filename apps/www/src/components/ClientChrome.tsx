import { Toaster } from '@gbfm/ui'
import { FPSMeter } from '@overengineering/fps-meter'
import { QueryClientProvider } from '@tanstack/react-query'
import { lazy, Suspense } from 'react'
import { VerifyEmailBanner } from '@/components/Auth/VerifyEmailBanner'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { AppChrome } from '@/components/Layout/AppShell'
import { OfflineBanner } from '@/components/OfflineBanner'
import { SpotifyConnectionProvider } from '@/components/spotify/SpotifyConnectionProvider'
import { ThemeProvider } from '@/components/ThemeProvider'
import { queryClient } from '@/lib/query-client'
import { PlayerProvider } from '@/services/player'

const AuthPromptDialog = lazy(() =>
  import('@/components/AuthPromptDialog').then((module) => ({ default: module.AuthPromptDialog }))
)
const WelcomeModal = lazy(() =>
  import('@/components/onboarding/WelcomeModal').then((module) => ({
    default: module.WelcomeModal
  }))
)

/** Persistent interactive chrome surrounding Astro-rendered page content. */
export function ClientChrome() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme='dark' storageKey='vite-ui-theme'>
        <PlayerProvider>
          <ErrorBoundary>
            <SpotifyConnectionProvider>
              {import.meta.env.DEV ? (
                <FPSMeter className='fixed top-0 right-0 z-50 hidden sm:block' height={40} />
              ) : null}
              <OfflineBanner />
              <VerifyEmailBanner />
              <AppChrome />
              <Suspense fallback={null}>
                <WelcomeModal />
                <AuthPromptDialog />
              </Suspense>
            </SpotifyConnectionProvider>
          </ErrorBoundary>
          <Toaster viewportClassName='lg:bottom-12' />
        </PlayerProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}
