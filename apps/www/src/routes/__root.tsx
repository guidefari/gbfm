import { Toaster } from '@gbfm/ui'
import { FPSMeter } from '@overengineering/fps-meter'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createRootRouteWithContext,
  HeadContent,
  Outlet
} from '@tanstack/react-router'
import { Suspense } from 'react'
import { VerifyEmailBanner } from '@/components/Auth/VerifyEmailBanner'
import { AuthPromptDialog } from '@/components/AuthPromptDialog'
import { CommandDialogDemo } from '@/components/cmd'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import AppShell from '@/components/Layout/AppShell'
import { WelcomeModal } from '@/components/onboarding/WelcomeModal'
import { ThemeProvider } from '@/components/ThemeProvider'
import { env } from '@/env'
import type { AuthState } from '@/store/auth'

export interface MyRouterContext {
  auth: AuthState
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000, // 5 minutes
      refetchOnWindowFocus: false,
      retry: 1
    }
  }
})

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
            <AppShell showFooter={location.pathname !== '/'}>
              {env.isDev && (
                <FPSMeter
                  className='fixed top-0 right-0 z-50 hidden sm:block'
                  height={40}
                />
              )}
              <VerifyEmailBanner />
              <CommandDialogDemo />
              <WelcomeModal />
              <AuthPromptDialog />
              <Outlet />
            </AppShell>
          </QueryClientProvider>
        </ThemeProvider>
      </ErrorBoundary>
      <Toaster />
      <Suspense>{/* <TanStackRouterDevtools position="" /> */}</Suspense>
    </>
  )
})
