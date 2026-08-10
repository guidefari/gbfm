import { and, eq, exists, lte } from 'drizzle-orm'
import { Effect, Option } from 'effect'
import { Database } from '@/db/layer'
import { audioTable } from '@/db/audio.schema'
import { user as usersTable } from '@/db/auth.schema'
import { musicLabelsTable } from '@/db/music-entity.schema'
import { postsTable } from '@/db/post.schema'
import { releasesTable } from '@/db/release.schema'
import { showsTable } from '@/db/show.schema'
import { DatabaseError } from '@/errors'
import { config } from '@/services/config.service'
import { SitemapCache } from '@/services/sitemap-cache'
import { buildSitemapXml, type SitemapData } from './sitemap.utils'

// Re-export types and pure functions from utils
export type { PostEntry, ProfileEntry, SitemapData, SitemapEntry } from './sitemap.utils'
export { buildSitemapIndexXml, buildSitemapXml, buildUrlEntry, formatDate } from './sitemap.utils'

// Database fetchers
const fetchMixes = (db: Database['Service']) =>
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

const fetchShows = (db: Database['Service']) =>
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

const fetchReleases = (db: Database['Service']) =>
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
                .select({ id: musicLabelsTable.id })
                .from(musicLabelsTable)
                .where(
                  and(
                    eq(musicLabelsTable.id, releasesTable.labelId),
                    lte(musicLabelsTable.publishedAt, new Date())
                  )
                )
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

const fetchLabels = (db: Database['Service']) =>
  Effect.tryPromise({
    try: () =>
      db
        .select({ slug: musicLabelsTable.slug, updatedAt: musicLabelsTable.updatedAt })
        .from(musicLabelsTable)
        .where(lte(musicLabelsTable.publishedAt, new Date())),
    catch: (error) =>
      new DatabaseError({
        message: String(error),
        operation: 'select',
        table: 'music_labels'
      })
  })

const fetchProfiles = (db: Database['Service']) =>
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

const fetchPosts = (db: Database['Service']) =>
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
  const db = yield* Database
  const [mixes, shows, releases, labels, profiles, posts] = yield* Effect.all([
    fetchMixes(db),
    fetchShows(db),
    fetchReleases(db),
    fetchLabels(db),
    fetchProfiles(db),
    fetchPosts(db)
  ])
  const sitemapData: SitemapData = { mixes, shows, releases, labels, profiles, posts }
  return sitemapData
})

// Regenerate and cache the sitemap
export const regenerateSitemap = Effect.gen(function* () {
  const cache = yield* SitemapCache
  const data = yield* fetchSitemapData
  const siteUrl = config.urls.frontend.replace(/\/$/, '')
  const vpsUrl = config.urls.vps.replace(/\/$/, '')
  const xml = buildSitemapXml(data, siteUrl, vpsUrl)

  const sitemap = { xml, generatedAt: new Date() }
  yield* cache.write(sitemap)

  yield* Effect.log(
    `✅ Sitemap regenerated with ${data.mixes.length} mixes, ${data.shows.length} shows, ${data.releases.length} releases, ${data.labels.length} labels, ${data.profiles.filter((p) => p.username).length} profiles, ${data.posts.length} posts`
  )

  return sitemap
})

// Get cached sitemap or generate if missing
export const getCachedSitemap = Effect.gen(function* () {
  const cache = yield* SitemapCache
  const cached = yield* cache.read()
  if (Option.isSome(cached)) {
    return cached.value
  }
  return yield* regenerateSitemap
})
