import { FPSMeter } from '@overengineering/fps-meter'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createRootRouteWithContext,
  HeadContent,
  Outlet
} from '@tanstack/react-router'
import { Suspense } from 'react'
import { CommandDialogDemo } from '@/components/cmd'
import AppShell from '@/components/Layout/AppShell'
import { ThemeProvider } from '@/components/ThemeProvider'
import { Toaster } from '@/components/ui/toaster'
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
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <AppShell showFooter={location.pathname !== '/'}>
            {env.isDev && (
              <FPSMeter className='fixed top-0 right-0 z-50' height={40} />
            )}
            <CommandDialogDemo />
            <Outlet />
          </AppShell>
        </QueryClientProvider>
      </ThemeProvider>
      <Toaster />
      <Suspense>{/* <TanStackRouterDevtools position="" /> */}</Suspense>
    </>
  )
})
