/**
 * Reserved slugs that cannot be used for usernames or show slugs.
 *
 * AUTO-GENERATED FILE - DO NOT EDIT DIRECTLY
 * Run `bun scripts/generate-reserved-slugs.ts` to regenerate.
 *
 * Generated from: apps/www/src/routeTree.gen.ts
 */

// Slugs derived from frontend routes
// TODO: generate this file programmatically
const ROUTE_SLUGS = [
  'admin',
  'auth',
  'changelog',
  'dashboard',
  'label-upload',
  'labels',
  'mix-upload',
  'mixes',
  'profile',
  'releases',
  'reminders',
  'settings',
  'shows',
  'subscribe',
  'tracks',
  'upload',
  'upload-old'
] as const

// Additional reserved words
const ADDITIONAL_RESERVED = [
  'about',
  'account',
  'api',
  'app',
  'blog',
  'contact',
  'false',
  'favicon.ico',
  'health',
  'help',
  'login',
  'logout',
  'me',
  'news',
  'null',
  'privacy',
  'register',
  'robots.txt',
  'search',
  'signin',
  'signup',
  'sitemap.xml',
  'support',
  'terms',
  'true',
  'undefined',
  'user',
  'users',
  'www'
] as const

export const RESERVED_SLUGS: Set<string> = new Set([
  ...ROUTE_SLUGS,
  ...ADDITIONAL_RESERVED
])

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.has(slug.toLowerCase())
}
