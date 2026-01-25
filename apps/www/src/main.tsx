import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createRouter, RouterProvider } from '@tanstack/react-router'
import React from 'react'
import { createRoot } from 'react-dom/client'
import { MAIN_SCROLL_CONTAINER_ID } from './lib/constants'
import { routeTree } from './routeTree.gen'
import './styles/main.css'
import { ThemeProvider } from './components/ThemeProvider'
import { useAuthSync } from './hooks/useAuthSync'
import { useIdentifyUser } from './hooks/useAnalytics'
import { useAuthStore } from './store/auth'
// Initialize analytics runtime (side-effect import)
import '@/services/analytics/runtime'

const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
  scrollRestoration: true,
  scrollToTopSelectors: [
    () => document.getElementById(MAIN_SCROLL_CONTAINER_ID)
  ],
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

function App() {
  const auth = useAuthStore()
  useAuthSync()

  // Identify user for analytics when authenticated
  useIdentifyUser(auth.user?.id, {
    email: auth.user?.email,
    name: auth.user?.name
  })

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
