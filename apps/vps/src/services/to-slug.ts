/**
 * Generates a URL-safe slug from text, appended with an 8-char random suffix for uniqueness.
 *
 * @example
 * toSlug('Four Tet') // => 'four-tet-a1b2c3d4'
 * toSlug('Burial & Four Tet!') // => 'burial-four-tet-e5f6g7h8'
 */
export const toSlug = (text: string) =>
  `${text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')}-${crypto.randomUUID().slice(0, 8)}`

/**
 * Returns the slug without its trailing random suffix (everything after the last hyphen).
 *
 * @example
 * stripSlugSuffix('four-tet-a1b2c3d4') // => 'four-tet'
 */
export const stripSlugSuffix = (slug: string) =>
  slug.slice(0, slug.lastIndexOf('-'))

/**
 * Returns the trailing random suffix of a slug (everything after the last hyphen).
 *
 * @example
 * getSlugSuffix('four-tet-a1b2c3d4') // => 'a1b2c3d4'
 */
export const getSlugSuffix = (slug: string) =>
  slug.slice(slug.lastIndexOf('-') + 1)
