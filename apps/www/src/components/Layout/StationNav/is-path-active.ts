export function isPathActive(pathname: string, slug: string) {
  if (slug === '/') return pathname === '/'
  return pathname === slug || pathname.startsWith(`${slug}/`)
}
