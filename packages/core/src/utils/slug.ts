export const MAX_SLUG_BASE_LENGTH = 32

export const normalizeSlugBase = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, MAX_SLUG_BASE_LENGTH)
    .replace(/-+$/g, '')
