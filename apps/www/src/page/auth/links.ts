export const authHref = (path: string, params: Readonly<Record<string, string>>): string => {
  const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== ''))

  return query.size === 0 ? path : `${path}?${query}`
}
