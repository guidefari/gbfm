import { Toaster } from '@gbfm/ui'
import { FPSMeter } from '@overengineering/fps-meter'
import { QueryClientProvider } from '@tanstack/react-query'
import { lazy, Suspense } from 'react'
import { VerifyEmailBanner } from '@/components/Auth/VerifyEmailBanner'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import AppShell from '@/components/Layout/AppShell'
import { OfflineBanner } from '@/components/OfflineBanner'
import { SpotifyConnectionProvider } from '@/components/spotify/SpotifyConnectionProvider'
import { ThemeProvider } from '@/components/ThemeProvider'
import { queryClient } from '@/lib/query-client'
import type { PageDefinition } from '@/lib/page'
import { PlayerProvider } from '@/services/player'

const AuthPromptDialog = lazy(() =>
  import('@/components/AuthPromptDialog').then((module) => ({ default: module.AuthPromptDialog }))
)
const WelcomeModal = lazy(() =>
  import('@/components/onboarding/WelcomeModal').then((module) => ({
    default: module.WelcomeModal
  }))
)

type PageAppProps<
  Params extends Readonly<Record<string, string | number>>,
  Search extends object,
  LoaderData
> = {
  readonly page: PageDefinition<Params, Search, LoaderData>
  readonly params: Params
  readonly search: Search
  readonly loaderData: Awaited<LoaderData>
}

function PageApp<
  Params extends Readonly<Record<string, string | number>>,
  Search extends object,
  LoaderData
>({ page, params, search, loaderData }: PageAppProps<Params, Search, LoaderData>) {
  const PageComponent = page.options.component
  const PageProvider = page.Provider

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme='dark' storageKey='vite-ui-theme'>
        <PlayerProvider>
          <ErrorBoundary>
            <SpotifyConnectionProvider>
              <AppShell>
                {import.meta.env.DEV ? (
                  <FPSMeter className='fixed top-0 right-0 z-50 hidden sm:block' height={40} />
                ) : null}
                <OfflineBanner />
                <VerifyEmailBanner />
                <PageProvider params={params} search={search} loaderData={loaderData}>
                  {PageComponent ? <PageComponent /> : null}
                </PageProvider>
                <Suspense fallback={null}>
                  <WelcomeModal />
                  <AuthPromptDialog />
                </Suspense>
              </AppShell>
            </SpotifyConnectionProvider>
          </ErrorBoundary>
          <Toaster viewportClassName='lg:bottom-12' />
        </PlayerProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}

/** Creates the serializable island entrypoint for one Astro-owned page module. */
export function createPageComponent<
  Params extends Readonly<Record<string, string | number>>,
  Search extends object,
  LoaderData
>(page: PageDefinition<Params, Search, LoaderData>) {
  return function AstroPageIsland(props: Omit<PageAppProps<Params, Search, LoaderData>, 'page'>) {
    return <PageApp page={page} {...props} />
  }
}
