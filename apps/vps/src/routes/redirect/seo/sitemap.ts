import { eq } from 'drizzle-orm'
import { Effect } from 'effect'
import type { Context } from 'hono'
import { db } from '@/db'
import { audioTable } from '@/db/audio.schema'
import { user as usersTable } from '@/db/auth.schema'
import { labelsTable } from '@/db/label.schema'
import { releasesTable } from '@/db/release.schema'
import { showsTable } from '@/db/show.schema'
import { DatabaseError } from '@/errors'
import { runApp } from '@/runtime'
import { config } from '@/services/config.service'

const getSiteUrl = (): string => {
  return config.urls.frontend.replace(/\/$/, '')
}

// Fetch all published content
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

const formatDate = (date: Date): string => {
  return date.toISOString().split('T')[0]
}

const buildUrlEntry = (
  loc: string,
  lastmod: Date,
  changefreq: string = 'weekly',
  priority: string = '0.8'
): string => {
  return `  <url>
    <loc>${loc}</loc>
    <lastmod>${formatDate(lastmod)}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`
}

export const sitemapXml = async (c: Context) => {
  const program = Effect.gen(function* () {
    const [mixes, shows, releases, labels, profiles] = yield* Effect.all([
      fetchMixes(),
      fetchShows(),
      fetchReleases(),
      fetchLabels(),
      fetchProfiles()
    ])
    return { mixes, shows, releases, labels, profiles }
  })

  const result = await runApp(program.pipe(Effect.either))

  if (result._tag === 'Left') {
    Effect.logError('[Sitemap] Error generating sitemap', {
      error:
        result.left instanceof Error
          ? result.left.message
          : String(result.left)
    }).pipe(Effect.runPromise)

    c.header('Content-Type', 'application/xml; charset=utf-8')
    return c.text(
      '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>',
      500
    )
  }

  const { mixes, shows, releases, labels, profiles } = result.right
  const siteUrl = getSiteUrl()
  const now = new Date()

  const urls: string[] = []

  // Homepage
  urls.push(buildUrlEntry(siteUrl, now, 'daily', '1.0'))

  // Static pages
  urls.push(buildUrlEntry(`${siteUrl}/mixes`, now, 'daily', '0.9'))
  urls.push(buildUrlEntry(`${siteUrl}/shows`, now, 'daily', '0.9'))
  urls.push(buildUrlEntry(`${siteUrl}/releases`, now, 'weekly', '0.7'))
  urls.push(buildUrlEntry(`${siteUrl}/labels`, now, 'weekly', '0.7'))

  // Mixes
  for (const mix of mixes) {
    urls.push(
      buildUrlEntry(`${siteUrl}/mixes/${mix.slug}`, mix.updatedAt, 'weekly')
    )
  }

  // Shows
  for (const show of shows) {
    urls.push(
      buildUrlEntry(`${siteUrl}/shows/${show.slug}`, show.updatedAt, 'weekly')
    )
  }

  // Releases
  for (const release of releases) {
    urls.push(
      buildUrlEntry(
        `${siteUrl}/releases/${release.slug}`,
        release.updatedAt,
        'monthly',
        '0.6'
      )
    )
  }

  // Labels
  for (const label of labels) {
    urls.push(
      buildUrlEntry(
        `${siteUrl}/labels/${label.slug}`,
        label.updatedAt,
        'monthly',
        '0.6'
      )
    )
  }

  // Profiles (only those with usernames)
  for (const profile of profiles) {
    if (profile.username) {
      urls.push(
        buildUrlEntry(
          `${siteUrl}/${profile.username}`,
          profile.updatedAt,
          'weekly',
          '0.5'
        )
      )
    }
  }

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>`

  c.header('Content-Type', 'application/xml; charset=utf-8')
  c.header('Cache-Control', 'public, max-age=3600') // 1 hour
  return c.text(sitemap)
}

// Sitemap index for future scalability
export const sitemapIndexXml = async (c: Context) => {
  const siteUrl = getSiteUrl()
  const now = formatDate(new Date())

  const sitemapIndex = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>${siteUrl}/sitemap.xml</loc>
    <lastmod>${now}</lastmod>
  </sitemap>
</sitemapindex>`

  c.header('Content-Type', 'application/xml; charset=utf-8')
  c.header('Cache-Control', 'public, max-age=3600')
  return c.text(sitemapIndex)
}
