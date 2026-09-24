import type { StandardSchemaV1 } from 'effect/StandardSchema'
import {
  PageRedirect,
  type PageAuth,
  type PageDefinition,
  type PageHead,
  type PageSearchInput
} from './page'

type RouteParams = Readonly<Record<string, string | number>>

/** Fully prepared request data passed to an Astro page island. */
export type PreparedPage<Params extends RouteParams, Search extends object, LoaderData> = {
  readonly params: Params
  readonly search: Search
  readonly loaderData: Awaited<LoaderData>
  readonly head: PageHead | undefined
}

const rawSearch = (url: URL): PageSearchInput => {
  const values: Record<string, string | ReadonlyArray<string>> = {}
  for (const key of new Set(url.searchParams.keys())) {
    const matches = url.searchParams.getAll(key)
    values[key] = matches.length === 1 ? matches[0] : matches
  }
  return values
}

const parseSearch = async <Search extends object>(
  validator: ((search: PageSearchInput) => Search) | StandardSchemaV1<unknown, Search> | undefined,
  input: PageSearchInput
): Promise<Search> => {
  if (validator === undefined) {
    // oxlint-disable-next-line typescript/consistent-type-assertions, typescript/no-unsafe-type-assertion -- SAFETY: createFileRoute defaults Search to PageSearchInput whenever no validator is present.
    return input as Search
  }
  if ('~standard' in validator) {
    const result = await validator['~standard'].validate(input)
    if (result.issues !== undefined) {
      throw new Error('Invalid page search parameters')
    }
    return result.value
  }

  return validator(input)
}

/** Executes one page's search parser, guard, loader, and metadata function for an Astro request. */
export async function preparePage<Params extends RouteParams, Search extends object, LoaderData>(
  page: PageDefinition<Params, Search, LoaderData>,
  url: URL,
  params: Params,
  auth: PageAuth
): Promise<PreparedPage<Params, Search, LoaderData>> {
  const search = await parseSearch(page.options.validateSearch, rawSearch(url))
  const input = {
    params,
    search,
    context: { auth },
    location: {
      href: url.href,
      pathname: url.pathname,
      search: url.search
    }
  }

  await page.options.beforeLoad?.(input)
  const loaderData = page.options.loader
    ? await page.options.loader(input)
    : // oxlint-disable-next-line typescript/consistent-type-assertions, typescript/no-unsafe-type-assertion -- SAFETY: createFileRoute defaults LoaderData to undefined whenever no loader is present.
      (undefined as Awaited<LoaderData>)

  return {
    params,
    search,
    loaderData,
    head: page.options.head?.({ params, loaderData })
  }
}

/** Returns true when a page preparation failure requests an HTTP redirect. */
export const isPageRedirect = (cause: unknown): cause is PageRedirect =>
  cause instanceof PageRedirect
