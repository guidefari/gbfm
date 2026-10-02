import { HashMap, Result } from 'effect'
import { AsyncData } from 'foldkit'

import type { Flags, PageCache } from './model'

const uncachedPrefixes = ['/dashboard', '/new', '/mix-upload', '/auth', '/reminders', '/spotify']

/** Keys ignore the origin because server-rendered Flags carry the internal worker host. */
export const pageKey = (href: string) => {
  const url = new URL(href, 'https://goosebumps.fm')

  return `${url.pathname}${url.search}`
}

/** Account, composer and auth screens always load fresh so drafts and permissions are never stale. */
export const isCacheable = (key: string) => {
  const pathname = key.split('?')[0] ?? key

  return !uncachedPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )
}

const withoutVolatile = ({ renderedAt: _renderedAt, requestId: _requestId, ...rest }: Flags) =>
  JSON.stringify(rest)

/** Revalidation only re-renders when the content changed, not when the request metadata did. */
export const samePage = (a: Flags, b: Flags) => withoutVolatile(a) === withoutVolatile(b)

export const settlePage = (
  cache: PageCache,
  key: string,
  result: Result.Result<Flags, string>,
): PageCache => {
  if (!isCacheable(key)) return cache
  const entry = AsyncData.fromOptionOrIdle(HashMap.get(cache, key))

  return HashMap.set(cache, key, AsyncData.settle(entry, result))
}

export const seedCache = (flags: Flags): PageCache =>
  settlePage(HashMap.empty(), pageKey(flags.url), Result.succeed(flags))
