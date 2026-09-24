import { createContext, use, type ComponentType, type ReactNode } from 'react'
import type { StandardSchemaV1 } from 'effect/StandardSchema'
import type { NavigateOptions } from './navigation'

type RouteParameter = string | number
type RouteParams = Readonly<Record<string, RouteParameter>>

/** Raw URL search values before a page-specific schema refines them. */
export type PageSearchInput = Readonly<Record<string, string | ReadonlyArray<string> | undefined>>

/** Authentication state available to page guards. */
export type PageAuth = {
  readonly user: {
    readonly id: string
    readonly name: string
    readonly email: string
    readonly role?: string | null
    readonly image?: string | null
  } | null
  readonly isAuthenticated: boolean
}

/** Request context passed to page guards. */
export type PageContext = {
  readonly auth: PageAuth
}

/** Location fields available while loading an Astro page. */
export type PageLocation = {
  readonly href: string
  readonly pathname: string
  readonly search: string
}

type PageLoadInput<Params extends RouteParams, Search extends object> = {
  readonly params: Params
  readonly search: Search
  readonly context: PageContext
  readonly location: PageLocation
}

type PageHeadInput<Params extends RouteParams, LoaderData> = {
  readonly params: Params
  readonly loaderData: Awaited<LoaderData> | undefined
}

/** Metadata emitted into an Astro document head. */
export type PageHead = {
  readonly meta?: ReadonlyArray<Readonly<Record<string, string | undefined>>>
  readonly links?: ReadonlyArray<Readonly<Record<string, string | undefined>>>
  readonly scripts?: ReadonlyArray<Readonly<Record<string, string | undefined>>>
}

type PageOptions<Params extends RouteParams, Search extends object, LoaderData> = {
  readonly component?: ComponentType
  readonly loader?: (input: PageLoadInput<Params, Search>) => LoaderData
  readonly beforeLoad?: (input: PageLoadInput<Params, Search>) => unknown
  readonly validateSearch?:
    | ((search: PageSearchInput) => Search)
    | StandardSchemaV1<unknown, Search>
  readonly head?: (input: PageHeadInput<Params, LoaderData>) => PageHead
  readonly pendingComponent?: ComponentType
  readonly errorComponent?: ComponentType<{ readonly error: Error }>
}

type PageState<Params extends RouteParams, Search extends object, LoaderData> = {
  readonly params: Params
  readonly search: Search
  readonly loaderData: Awaited<LoaderData>
}

/** A page module consumed by an explicit Astro route. */
export type PageDefinition<
  Params extends RouteParams = RouteParams,
  Search extends object = PageSearchInput,
  LoaderData = unknown
> = {
  readonly path: string
  readonly options: PageOptions<Params, Search, LoaderData>
  readonly useParams: () => Params
  readonly useSearch: () => Search
  readonly useLoaderData: () => Awaited<LoaderData>
  readonly Provider: (
    props: PageState<Params, Search, LoaderData> & { readonly children: ReactNode }
  ) => ReactNode
}

type ParamsFromPath<Path extends string> = Path extends `${string}$${infer Name}/${infer Rest}`
  ? Readonly<Record<Name, string>> & ParamsFromPath<`/${Rest}`>
  : Path extends `${string}$${infer Name}`
    ? Readonly<Record<Name, string>>
    : RouteParams

/** Defines data and rendering behavior for one explicit Astro route. */
export function createFileRoute<Path extends string>(path: Path) {
  return <Search extends object = PageSearchInput, LoaderData = undefined>(
    options: PageOptions<ParamsFromPath<Path>, Search, LoaderData>
  ): PageDefinition<ParamsFromPath<Path>, Search, LoaderData> => {
    const PageStateContext = createContext<
      PageState<ParamsFromPath<Path>, Search, LoaderData> | undefined
    >(undefined)

    const usePageState = () => {
      const state = use(PageStateContext)
      if (state === undefined) throw new Error(`Page ${path} rendered without its Astro page state`)
      return state
    }

    return {
      path,
      options,
      useParams: () => usePageState().params,
      useSearch: () => usePageState().search,
      useLoaderData: () => usePageState().loaderData,
      Provider: ({ children, ...state }) => (
        <PageStateContext value={state}>{children}</PageStateContext>
      )
    }
  }
}

/** Defines the client implementation for a page split into a lazy module. */
export const createLazyFileRoute = createFileRoute

/** Signals an Astro redirect from a guard or loader. */
export function redirect(options: NavigateOptions): never {
  throw new PageRedirect(options)
}

/** Typed redirect signal handled by the Astro request adapter. */
export class PageRedirect extends Error {
  readonly options: NavigateOptions

  constructor(options: NavigateOptions) {
    super('Page redirect')
    this.name = 'PageRedirect'
    this.options = options
  }
}

/** Placeholder retained only for layout-only modules that are not Astro pages. */
export function Outlet() {
  return null
}
