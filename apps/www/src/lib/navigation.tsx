import {
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type AnchorHTMLAttributes
} from 'react'
import { navigate as astroNavigate } from 'astro:transitions/client'

type RouteParameter = string | number
type SearchValue = string | number | boolean | null | undefined

/** Options accepted by browser-backed navigation operations. */
export type NavigateOptions = {
  readonly to?: string
  readonly href?: string
  readonly params?: Readonly<Record<string, RouteParameter>>
  readonly search?: Readonly<Record<string, SearchValue | ReadonlyArray<SearchValue>>>
  readonly replace?: boolean
}

/** Props for an anchor that builds its href from a route template. */
export type LinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> &
  NavigateOptions & {
    readonly to: string
  }

/** The browser location fields exposed to ordinary client components. */
export type NavigationLocation = {
  readonly pathname: string
  readonly search: string
  readonly hash: string
  readonly href: string
}

/** The narrow router interface supported while Astro owns route handling. */
export type BrowserRouter = {
  readonly navigate: (options: NavigateOptions) => Promise<void>
  readonly preloadRoute: (options: NavigateOptions) => Promise<void>
  readonly invalidate: () => Promise<void>
  readonly history: {
    readonly back: () => void
  }
}

const serverLocation: NavigationLocation = {
  pathname: '/',
  search: '',
  hash: '',
  href: '/'
}
let cachedBrowserLocation: NavigationLocation | undefined

const routeParameterPattern = /\$([A-Za-z_][A-Za-z0-9_]*)/g

function getBrowserWindow(): Window | undefined {
  return globalThis.window
}

function currentLocation(): NavigationLocation {
  const browserWindow = getBrowserWindow()
  if (browserWindow === undefined) return serverLocation

  if (cachedBrowserLocation?.href === browserWindow.location.href) return cachedBrowserLocation

  cachedBrowserLocation = {
    pathname: browserWindow.location.pathname,
    search: browserWindow.location.search,
    hash: browserWindow.location.hash,
    href: browserWindow.location.href
  }
  return cachedBrowserLocation
}

function subscribeToLocation(onStoreChange: () => void): () => void {
  const browserWindow = getBrowserWindow()
  if (browserWindow === undefined) return () => undefined

  browserWindow.addEventListener('popstate', onStoreChange)
  browserWindow.addEventListener('hashchange', onStoreChange)
  return () => {
    browserWindow.removeEventListener('popstate', onStoreChange)
    browserWindow.removeEventListener('hashchange', onStoreChange)
  }
}

function appendSearchValue(search: URLSearchParams, key: string, value: SearchValue): void {
  if (value === undefined || value === null) return
  search.append(key, String(value))
}

function isSearchValueArray(
  value: SearchValue | ReadonlyArray<SearchValue>
): value is ReadonlyArray<SearchValue> {
  return Array.isArray(value)
}

/** Builds a concrete URL from a route template, path parameters, and search values. */
export function buildHref(options: NavigateOptions): string {
  if (options.href !== undefined) return options.href

  const template = options.to ?? getBrowserWindow()?.location.pathname ?? serverLocation.pathname
  const pathname = template.replace(routeParameterPattern, (placeholder, name: string) => {
    const value = options.params?.[name]
    return value === undefined ? placeholder : encodeURIComponent(String(value))
  })

  if (options.search === undefined) return pathname

  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(options.search)) {
    if (isSearchValueArray(value)) {
      for (const item of value) appendSearchValue(search, key, item)
    } else {
      appendSearchValue(search, key, value)
    }
  }
  const query = search.toString()
  return query === '' ? pathname : `${pathname}?${query}`
}

export function navigateBrowser(options: NavigateOptions): Promise<void> {
  const browserWindow = getBrowserWindow()
  if (browserWindow === undefined) return Promise.resolve()

  const href = buildHref(options)
  return astroNavigate(href, { history: options.replace === true ? 'replace' : 'push' })
}

/** Renders an ordinary anchor whose href is built from route params and search values. */
export const Link = forwardRef<HTMLAnchorElement, LinkProps>(function Link(
  { to, params, search, replace: _replace, href: _href, children, ...anchorProps },
  ref
) {
  return (
    <a {...anchorProps} href={buildHref({ to, params, search })} ref={ref}>
      {children}
    </a>
  )
})

/** Starts an Astro client navigation after hydration and renders nothing during SSR. */
export function Navigate(options: NavigateOptions) {
  const href = buildHref(options)
  useEffect(() => {
    void navigateBrowser({ href, replace: options.replace })
  }, [href, options.replace])
  return null
}

/** Returns a stable callback that performs Astro client navigation. */
export function useNavigate(): BrowserRouter['navigate'] {
  return useCallback((options: NavigateOptions) => navigateBrowser(options), [])
}

/** Returns the current browser location, or a safe root location during SSR. */
export function useLocation(): NavigationLocation {
  return useSyncExternalStore(subscribeToLocation, currentLocation, () => serverLocation)
}

/** Returns the browser-backed subset of the former client router. */
export function useRouter(): BrowserRouter {
  const navigate = useNavigate()
  return useMemo(
    () => ({
      navigate,
      preloadRoute: () => Promise.resolve(),
      invalidate: () => {
        getBrowserWindow()?.location.reload()
        return Promise.resolve()
      },
      history: {
        back: () => {
          getBrowserWindow()?.history.back()
        }
      }
    }),
    [navigate]
  )
}

/** Reports whether the browser has an earlier history entry available. */
export function useCanGoBack(): boolean {
  return (getBrowserWindow()?.history.length ?? 0) > 1
}
