import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createRouter, RouterProvider } from '@tanstack/react-router'
import React from 'react'
import { createRoot } from 'react-dom/client'
import { routeTree } from './routeTree.gen'
import './styles/main.css'
import { PostHogProvider } from 'posthog-js/react'
import { ThemeProvider } from './components/ThemeProvider'
import { env } from './env'
import { useAuthSync } from './hooks/useAuthSync'
import { useAuthStore } from './store/auth'

const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
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
      <PostHogProvider
        apiKey={import.meta.env.VITE_PUBLIC_POSTHOG_KEY}
        options={{
          api_host: import.meta.env.VITE_PUBLIC_POSTHOG_HOST,
          defaults: '2025-05-24',
          capture_exceptions: true, // This enables capturing exceptions using Error Tracking, set to false if you don't want this
          debug: env.isDev
        }}>
        <App />
      </PostHogProvider>
    </React.StrictMode>
  )
} else {
  throw new Error(
    "Root element with ID 'root' was not found in the document. Ensure there is a corresponding HTML element with the ID 'root' in your HTML file."
  )
}
