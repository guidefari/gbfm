import { and, eq, exists } from 'drizzle-orm'
import { Effect } from 'effect'
import { db } from '@/db'
import { audioTable } from '@/db/audio.schema'
import { user as usersTable } from '@/db/auth.schema'
import { labelsTable } from '@/db/label.schema'
import { postsTable } from '@/db/post.schema'
import { releasesTable } from '@/db/release.schema'
import { showsTable } from '@/db/show.schema'
import { DatabaseError } from '@/errors'
import { config } from '@/services/config.service'
import { buildSitemapXml, type SitemapData } from './sitemap.utils'

// Re-export types and pure functions from utils
export type { PostEntry, ProfileEntry, SitemapData, SitemapEntry } from './sitemap.utils'
export { buildSitemapIndexXml, buildSitemapXml, buildUrlEntry, formatDate } from './sitemap.utils'

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
        .where(and(eq(audioTable.draft, false), eq(audioTable.type, 'mix'))),
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
        .where(
          and(
            eq(releasesTable.draft, false),
            exists(
              db
                .select({ id: labelsTable.id })
                .from(labelsTable)
                .where(and(eq(labelsTable.id, releasesTable.labelId), eq(labelsTable.draft, false)))
            )
          )
        ),
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

const fetchPosts = () =>
  Effect.tryPromise({
    try: () =>
      db
        .select({
          slug: postsTable.slug,
          updatedAt: postsTable.updatedAt,
          type: postsTable.type
        })
        .from(postsTable)
        .where(eq(postsTable.draft, false)),
    catch: (error) =>
      new DatabaseError({
        message: String(error),
        operation: 'select',
        table: 'posts'
      })
  })

// Effect to fetch all sitemap data
export const fetchSitemapData = Effect.gen(function* () {
  const [mixes, shows, releases, labels, profiles, posts] = yield* Effect.all([
    fetchMixes(),
    fetchShows(),
    fetchReleases(),
    fetchLabels(),
    fetchProfiles(),
    fetchPosts()
  ])
  const sitemapData: SitemapData = { mixes, shows, releases, labels, profiles, posts }
  return sitemapData
})

// Regenerate and cache the sitemap
export const regenerateSitemap = Effect.gen(function* () {
  const data = yield* fetchSitemapData
  const siteUrl = config.urls.frontend.replace(/\/$/, '')
  const vpsUrl = config.urls.vps.replace(/\/$/, '')
  const xml = buildSitemapXml(data, siteUrl, vpsUrl)

  sitemapCache = {
    xml,
    generatedAt: new Date()
  }

  yield* Effect.log(
    `✅ Sitemap regenerated with ${data.mixes.length} mixes, ${data.shows.length} shows, ${data.releases.length} releases, ${data.labels.length} labels, ${data.profiles.filter((p) => p.username).length} profiles, ${data.posts.length} posts`
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
