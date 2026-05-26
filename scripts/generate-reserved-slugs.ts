#!/usr/bin/env bun

/**
 * Generates apps/vps/src/lib/reserved-slugs.ts from the TanStack Router
 * route tree (apps/www/src/routeTree.gen.ts).
 *
 * Usage: bun scripts/generate-reserved-slugs.ts
 */

import { readFileSync, writeFileSync } from 'fs'
import { resolve } from 'path'

const ROOT_DIR = resolve(import.meta.dir, '..')
const ROUTE_TREE_PATH = resolve(ROOT_DIR, 'apps/www/src/routeTree.gen.ts')
const OUTPUT_PATH = resolve(ROOT_DIR, 'apps/vps/src/lib/reserved-slugs.ts')

function extractRouteSlugs(content: string): string[] {
  // Pull full-path keys from the FileRoutesByFullPath interface, which lists
  // every route as a complete path (e.g. '/admin/music', '/shows/$showSlug').
  const interfaceMatch = content.match(
    /export interface FileRoutesByFullPath \{([^}]+)\}/,
  )
  if (!interfaceMatch) {
    throw new Error('Could not find FileRoutesByFullPath interface in route tree')
  }

  const interfaceContent = interfaceMatch[1]
  const pathRegex = /^\s*'([^']+)':/gm
  const slugs = new Set<string>()

  let match: RegExpExecArray | null
  while ((match = pathRegex.exec(interfaceContent)) !== null) {
    const fullPath = match[1]
    // Take the first non-empty segment; skip dynamic params (start with $).
    const segment = fullPath.split('/').find((s) => s && !s.startsWith('$'))
    if (segment) slugs.add(segment)
  }

  return [...slugs].sort()
}

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
  'www',
]

const routeTreeContent = readFileSync(ROUTE_TREE_PATH, 'utf-8')
const routeSlugs = extractRouteSlugs(routeTreeContent)

const outputContent = `/**
 * Reserved slugs that cannot be used for usernames or show slugs.
 *
 * AUTO-GENERATED FILE - DO NOT EDIT DIRECTLY
 * Run \`bun scripts/generate-reserved-slugs.ts\` to regenerate.
 *
 * Generated from: apps/www/src/routeTree.gen.ts
 */

// Slugs derived from frontend routes
const ROUTE_SLUGS = [
${routeSlugs.map((s) => `  '${s}',`).join('\n')}
] as const

// Additional reserved words
const ADDITIONAL_RESERVED = [
${ADDITIONAL_RESERVED.map((s) => `  '${s}',`).join('\n')}
] as const

export const RESERVED_SLUGS: Set<string> = new Set([
  ...ROUTE_SLUGS,
  ...ADDITIONAL_RESERVED
])

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.has(slug.toLowerCase())
}
`

writeFileSync(OUTPUT_PATH, outputContent)
console.log(`Written: ${OUTPUT_PATH}`)
console.log(`Route slugs (${routeSlugs.length}): ${routeSlugs.join(', ')}`)
