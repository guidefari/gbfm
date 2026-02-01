import { eq } from 'drizzle-orm'
import { Effect } from 'effect'
import { db } from '@/db'
import { audioTable } from '@/db/audio.schema'
import { user as usersTable } from '@/db/auth.schema'
import { labelsTable } from '@/db/label.schema'
import { releasesTable } from '@/db/release.schema'
import { showsTable } from '@/db/show.schema'
import { DatabaseError } from '@/errors'
import { config } from '@/services/config.service'
import { buildSitemapXml, type SitemapData } from './sitemap.utils'

// Re-export types and pure functions from utils
export type { ProfileEntry, SitemapData, SitemapEntry } from './sitemap.utils'
export {
  buildSitemapIndexXml,
  buildSitemapXml,
  buildUrlEntry,
  formatDate
} from './sitemap.utils'

// Cache for generated sitemap
let sitemapCache: { xml: string; generatedAt: Date } | null = null

export const getSitemapCache = () => sitemapCache

export const clearSitemapCache = () => {
  sitemapCache = null
}

// Database fetchers
const fetchMixes = () =>
  Effect.tryPromise({
    try: () =>
      db
        .select({ slug: audioTable.slug, updatedAt: audioTable.updatedAt })
        .from(audioTable)
        .where(eq(audioTable.draft, false)),
    catch: (error) =>
      new DatabaseError({
        message: String(error),
        operation: 'select',
        table: 'audio'
      })
  })

const fetchShows = () =>
  Effect.tryPromise({
    try: () =>
      db
        .select({ slug: showsTable.slug, updatedAt: showsTable.updatedAt })
        .from(showsTable)
        .where(eq(showsTable.draft, false)),
    catch: (error) =>
      new DatabaseError({
        message: String(error),
        operation: 'select',
        table: 'shows'
      })
  })

const fetchReleases = () =>
  Effect.tryPromise({
    try: () =>
      db
        .select({
          slug: releasesTable.slug,
          updatedAt: releasesTable.updatedAt
        })
        .from(releasesTable)
        .where(eq(releasesTable.draft, false)),
    catch: (error) =>
      new DatabaseError({
        message: String(error),
        operation: 'select',
        table: 'releases'
      })
  })

const fetchLabels = () =>
  Effect.tryPromise({
    try: () =>
      db
        .select({ slug: labelsTable.slug, updatedAt: labelsTable.updatedAt })
        .from(labelsTable)
        .where(eq(labelsTable.draft, false)),
    catch: (error) =>
      new DatabaseError({
        message: String(error),
        operation: 'select',
        table: 'labels'
      })
  })

const fetchProfiles = () =>
  Effect.tryPromise({
    try: () =>
      db
        .select({
          username: usersTable.username,
          updatedAt: usersTable.updatedAt
        })
        .from(usersTable)
        .where(eq(usersTable.banned, false)),
    catch: (error) =>
      new DatabaseError({
        message: String(error),
        operation: 'select',
        table: 'user'
      })
  })

// Effect to fetch all sitemap data
export const fetchSitemapData = Effect.gen(function* () {
  const [mixes, shows, releases, labels, profiles] = yield* Effect.all([
    fetchMixes(),
    fetchShows(),
    fetchReleases(),
    fetchLabels(),
    fetchProfiles()
  ])
  return { mixes, shows, releases, labels, profiles } as SitemapData
})

// Regenerate and cache the sitemap
export const regenerateSitemap = Effect.gen(function* () {
  const data = yield* fetchSitemapData
  const siteUrl = config.urls.frontend.replace(/\/$/, '')
  const xml = buildSitemapXml(data, siteUrl)

  sitemapCache = {
    xml,
    generatedAt: new Date()
  }

  yield* Effect.log(
    `✅ Sitemap regenerated with ${data.mixes.length} mixes, ${data.shows.length} shows, ${data.releases.length} releases, ${data.labels.length} labels, ${data.profiles.filter((p) => p.username).length} profiles`
  )

  return sitemapCache
})

// Get cached sitemap or generate if missing
export const getCachedSitemap = Effect.gen(function* () {
  if (sitemapCache) {
    return sitemapCache
  }
  return yield* regenerateSitemap
})
