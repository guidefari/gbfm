#!/usr/bin/env bun
/**
 * Public API parity diff between the production stack and the D1 Worker.
 *
 * Fetches the same endpoints from both, then compares canonically: objects by
 * key, arrays by element. Lists are additionally re-compared after sorting by
 * `id` so a pure ordering difference is reported separately from a content
 * difference, which is the distinction OPS-249 turned on.
 *
 * Usage:
 *   bun run scripts/api-test/parity.ts
 *   bun run scripts/api-test/parity.ts --verbose
 */

const PRODUCTION = process.env.PARITY_PRODUCTION_URL ?? 'https://vps.goosebumps.fm'
const CANDIDATE =
  process.env.PARITY_CANDIDATE_URL ??
  'https://gbfm-api-d1-staging-mebtavpzy2m53eso.guideg6.workers.dev'

const ENDPOINTS = [
  '/health/live',
  '/health/ready',
  '/api/shows?limit=2&offset=0',
  '/api/content/posts?limit=2&offset=0',
  '/api/content/posts/micro?limit=2&offset=0',
  '/api/content/audio/mix?limit=2&offset=0',
  '/api/content/audio/track?limit=2&offset=0',
  '/api/music/artists',
  '/api/music/albums',
  '/api/music/tracks',
  '/api/music/labels',
  '/api/music/playlists',
  '/api/search?q=ambient&limit=2',
  '/api/profile/guidefari'
] as const

type Json = string | number | boolean | null | { [key: string]: Json } | Array<Json>

type Difference = {
  readonly path: string
  readonly production: Json | undefined
  readonly candidate: Json | undefined
}

const isObject = (value: Json | undefined): value is { [key: string]: Json } =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const diff = (
  production: Json | undefined,
  candidate: Json | undefined,
  path = ''
): Array<Difference> => {
  if (Array.isArray(production) && Array.isArray(candidate)) {
    if (production.length !== candidate.length) {
      return [
        { path: `${path}.length`, production: production.length, candidate: candidate.length }
      ]
    }
    return production.flatMap((row, index) => diff(row, candidate[index], `${path}[${index}]`))
  }

  if (isObject(production) && isObject(candidate)) {
    const keys = new Set([...Object.keys(production), ...Object.keys(candidate)])
    return [...keys].flatMap((key) =>
      diff(production[key], candidate[key], path === '' ? key : `${path}.${key}`)
    )
  }

  if (JSON.stringify(production) !== JSON.stringify(candidate)) {
    return [{ path: path === '' ? '<root>' : path, production, candidate }]
  }
  return []
}

/** Recursively sorts any array of objects carrying an `id`, so order stops mattering. */
const sortById = (value: Json): Json => {
  if (Array.isArray(value)) {
    const sorted = value.map(sortById)
    const allKeyed = sorted.every((row) => isObject(row) && typeof row.id === 'string')
    if (!allKeyed) return sorted
    return [...sorted].sort((left, right) => {
      const l = isObject(left) && typeof left.id === 'string' ? left.id : ''
      const r = isObject(right) && typeof right.id === 'string' ? right.id : ''
      return l < r ? -1 : l > r ? 1 : 0
    })
  }
  if (isObject(value)) {
    return Object.fromEntries(Object.entries(value).map(([key, inner]) => [key, sortById(inner)]))
  }
  return value
}

const fetchEndpoint = async (base: string, endpoint: string) => {
  const response = await fetch(`${base}${endpoint}`, {
    headers: { accept: 'application/json' }
  })
  const text = await response.text()
  try {
    const body: Json = JSON.parse(text)
    return { status: response.status, body }
  } catch {
    return { status: response.status, body: text }
  }
}

const verbose = Bun.argv.includes('--verbose')

console.log(`production: ${PRODUCTION}`)
console.log(`candidate:  ${CANDIDATE}\n`)

const summary: Array<{
  endpoint: string
  status: string
  verdict: string
  differences: number
}> = []

for (const endpoint of ENDPOINTS) {
  const [production, candidate] = await Promise.all([
    fetchEndpoint(PRODUCTION, endpoint),
    fetchEndpoint(CANDIDATE, endpoint)
  ])

  const status =
    production.status === candidate.status
      ? String(production.status)
      : `${production.status} vs ${candidate.status}`

  const ordered = diff(production.body, candidate.body)
  const unordered = diff(sortById(production.body), sortById(candidate.body))

  const verdict =
    ordered.length === 0
      ? 'exact'
      : unordered.length === 0
        ? 'order only'
        : `${unordered.length} field diffs`

  summary.push({ endpoint, status, verdict, differences: unordered.length })

  if (verbose && unordered.length > 0) {
    console.log(`\n${endpoint}`)
    for (const d of unordered.slice(0, 10)) {
      console.log(
        `  ${d.path}\n    production: ${JSON.stringify(d.production)?.slice(0, 120)}\n    candidate:  ${JSON.stringify(d.candidate)?.slice(0, 120)}`
      )
    }
    if (unordered.length > 10) console.log(`  ... ${unordered.length - 10} more`)
  }
}

console.table(summary)

const exact = summary.filter((s) => s.verdict === 'exact').length
const orderOnly = summary.filter((s) => s.verdict === 'order only').length
console.log(
  `\n${exact}/${summary.length} exact, ${orderOnly} order-only, ` +
    `${summary.length - exact - orderOnly} with field differences`
)
