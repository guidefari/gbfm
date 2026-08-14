/** Resolves a public CDN path to one of the two R2 bucket bindings. */
export function matchRoute<TBucket>(
  pathname: string,
  buckets: {
    readonly USER_CONTENT: TBucket
    readonly MIXES: TBucket
  }
): { readonly bucket: TBucket; readonly key: string } | null {
  const userContentPrefix = '/user-content/'
  if (pathname.startsWith(userContentPrefix)) {
    const key = pathname.slice(userContentPrefix.length)
    return key.length === 0 ? null : { bucket: buckets.USER_CONTENT, key }
  }

  const mixesPrefix = '/mixes/'
  if (pathname.startsWith(mixesPrefix)) {
    const key = pathname.slice(mixesPrefix.length)
    return key.length === 0 ? null : { bucket: buckets.MIXES, key }
  }

  return null
}
