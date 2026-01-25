import { useCallback, useEffect } from 'react'
import { Effect } from 'effect'
import {
  AnalyticsService,
  runAnalytics,
  type EventProperties,
  type UserProperties
} from '@/services/analytics'

/**
 * Hook for tracking analytics events in React components
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { track, identify } = useAnalytics()
 *
 *   const handleClick = () => {
 *     track('button_clicked', { button_name: 'submit' })
 *   }
 *
 *   return <button onClick={handleClick}>Submit</button>
 * }
 * ```
 */
export function useAnalytics() {
  const track = useCallback(
    (eventName: string, properties?: EventProperties) => {
      runAnalytics(
        Effect.gen(function* () {
          const analytics = yield* AnalyticsService
          yield* analytics.track(eventName, properties)
        })
      )
    },
    []
  )

  const identify = useCallback(
    (userId: string, properties?: UserProperties) => {
      runAnalytics(
        Effect.gen(function* () {
          const analytics = yield* AnalyticsService
          yield* analytics.identify(userId, properties)
        })
      )
    },
    []
  )

  const reset = useCallback(() => {
    runAnalytics(
      Effect.gen(function* () {
        const analytics = yield* AnalyticsService
        yield* analytics.reset()
      })
    )
  }, [])

  const pageView = useCallback(
    (pageName?: string, properties?: EventProperties) => {
      runAnalytics(
        Effect.gen(function* () {
          const analytics = yield* AnalyticsService
          yield* analytics.pageView(pageName, properties)
        })
      )
    },
    []
  )

  const setUserProperties = useCallback((properties: UserProperties) => {
    runAnalytics(
      Effect.gen(function* () {
        const analytics = yield* AnalyticsService
        yield* analytics.setUserProperties(properties)
      })
    )
  }, [])

  const optOut = useCallback(() => {
    runAnalytics(
      Effect.gen(function* () {
        const analytics = yield* AnalyticsService
        yield* analytics.optOut()
      })
    )
  }, [])

  const optIn = useCallback(() => {
    runAnalytics(
      Effect.gen(function* () {
        const analytics = yield* AnalyticsService
        yield* analytics.optIn()
      })
    )
  }, [])

  return {
    track,
    identify,
    reset,
    pageView,
    setUserProperties,
    optOut,
    optIn
  }
}

/**
 * Hook for tracking page views on route changes
 * Use this in your root layout or router component
 *
 * @example
 * ```tsx
 * function RootLayout() {
 *   usePageViewTracking()
 *   return <Outlet />
 * }
 * ```
 */
export function usePageViewTracking(pageName?: string) {
  const { pageView } = useAnalytics()

  useEffect(() => {
    pageView(pageName)
  }, [pageName, pageView])
}

/**
 * Hook to identify user when they log in
 * Automatically resets analytics when user logs out
 *
 * @example
 * ```tsx
 * function App() {
 *   const user = useAuthStore((s) => s.user)
 *   useIdentifyUser(user?.id, { email: user?.email, name: user?.name })
 *   return <Router />
 * }
 * ```
 */
export function useIdentifyUser(
  userId: string | null | undefined,
  properties?: UserProperties
) {
  const { identify, reset } = useAnalytics()

  useEffect(() => {
    if (userId) {
      identify(userId, properties)
    } else {
      reset()
    }
  }, [userId, identify, reset, properties])
}
