import { describe, expect, test, vi } from 'vitest'
import type { SitemapData } from './sitemap.utils'
import { buildSitemapIndexXml, buildSitemapXml, buildUrlEntry, formatDate } from './sitemap.utils'

describe('sitemap.utils', () => {
  describe('formatDate', () => {
    test('formats date as YYYY-MM-DD', () => {
      const date = new Date('2024-06-15T12:30:00Z')
      expect(formatDate(date)).toBe('2024-06-15')
    })
  })

  describe('buildUrlEntry', () => {
    test('builds URL entry with all fields', () => {
      const date = new Date('2024-06-15T12:30:00Z')
      const entry = buildUrlEntry('https://goosebumps.fm/mixes/test-mix', date, 'weekly', '0.8')

      expect(entry).toMatchInlineSnapshot(`
        "  <url>
            <loc>https://goosebumps.fm/mixes/test-mix</loc>
            <lastmod>2024-06-15</lastmod>
            <changefreq>weekly</changefreq>
            <priority>0.8</priority>
          </url>"
      `)
    })

    test('uses default values for changefreq and priority', () => {
      const date = new Date('2024-06-15T12:30:00Z')
      const entry = buildUrlEntry('https://goosebumps.fm/test', date)

      expect(entry).toContain('<changefreq>weekly</changefreq>')
      expect(entry).toContain('<priority>0.8</priority>')
    })
  })

  describe('buildSitemapXml', () => {
    const mockData: SitemapData = {
      mixes: [
        { slug: 'summer-vibes', updatedAt: new Date('2024-06-01') },
        { slug: 'chill-beats', updatedAt: new Date('2024-06-10') }
      ],
      shows: [{ slug: 'weekly-mix', updatedAt: new Date('2024-05-15') }],
      releases: [{ slug: 'debut-album', updatedAt: new Date('2024-04-20') }],
      labels: [{ slug: 'underground-sounds', updatedAt: new Date('2024-03-01') }],
      profiles: [
        { username: 'dj-cool', updatedAt: new Date('2024-06-12') },
        { username: null, updatedAt: new Date('2024-06-12') } // Should be filtered out
      ],
      posts: [
        {
          slug: 'my-editorial',
          updatedAt: new Date('2024-06-05'),
          type: 'post'
        },
        { slug: 'my-tweet', updatedAt: new Date('2024-06-08'), type: 'micro' }
      ]
    }

    test('generates valid sitemap XML structure', () => {
      const xml = buildSitemapXml(mockData, 'https://goosebumps.fm')

      // Check XML declaration and namespace
      expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>')
      expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')
      expect(xml).toContain('</urlset>')
    })

    test('includes homepage with highest priority', () => {
      const xml = buildSitemapXml(mockData, 'https://goosebumps.fm')

      expect(xml).toContain('<loc>https://goosebumps.fm</loc>')
      expect(xml).toContain('<priority>1.0</priority>')
      expect(xml).toContain('<changefreq>daily</changefreq>')
    })

    test('includes static listing pages', () => {
      const xml = buildSitemapXml(mockData, 'https://goosebumps.fm')

      expect(xml).toContain('<loc>https://goosebumps.fm/mixes</loc>')
      expect(xml).toContain('<loc>https://goosebumps.fm/shows</loc>')
      expect(xml).toContain('<loc>https://goosebumps.fm/releases</loc>')
      expect(xml).toContain('<loc>https://goosebumps.fm/labels</loc>')
      expect(xml).toContain('<loc>https://goosebumps.fm/editorial</loc>')
      expect(xml).toContain('<loc>https://goosebumps.fm/tweet</loc>')
    })

    test('includes all mixes', () => {
      const xml = buildSitemapXml(mockData, 'https://goosebumps.fm')

      expect(xml).toContain('<loc>https://goosebumps.fm/mixes/summer-vibes</loc>')
      expect(xml).toContain('<loc>https://goosebumps.fm/mixes/chill-beats</loc>')
    })

    test('includes shows', () => {
      const xml = buildSitemapXml(mockData, 'https://goosebumps.fm')

      expect(xml).toContain('<loc>https://goosebumps.fm/shows/weekly-mix</loc>')
    })

    test('includes releases with lower priority', () => {
      const xml = buildSitemapXml(mockData, 'https://goosebumps.fm')

      expect(xml).toContain('<loc>https://goosebumps.fm/releases/debut-album</loc>')
      // Check that releases have priority 0.6
      const releaseSection = xml.substring(
        xml.indexOf('releases/debut-album'),
        xml.indexOf('releases/debut-album') + 200
      )
      expect(releaseSection).toContain('<priority>0.6</priority>')
    })

    test('includes labels', () => {
      const xml = buildSitemapXml(mockData, 'https://goosebumps.fm')

      expect(xml).toContain('<loc>https://goosebumps.fm/labels/underground-sounds</loc>')
    })

    test('includes profiles with usernames only', () => {
      const xml = buildSitemapXml(mockData, 'https://goosebumps.fm')

      // Should include user with username
      expect(xml).toContain('<loc>https://goosebumps.fm/dj-cool</loc>')

      // Should NOT include user without username (null username)
      // Count occurrences of profile URLs - should only be 1
      const profileMatches = xml.match(/goosebumps\.fm\/[a-z-]+<\/loc>/g)
      const nonStaticProfiles = profileMatches?.filter(
        (m) =>
          !m.includes('/mixes') &&
          !m.includes('/shows') &&
          !m.includes('/releases') &&
          !m.includes('/labels') &&
          !m.includes('/editorial') &&
          !m.includes('/tweet')
      )
      expect(nonStaticProfiles).toHaveLength(1)
    })

    test('includes editorial posts at /editorial/:slug', () => {
      const xml = buildSitemapXml(mockData, 'https://goosebumps.fm')

      expect(xml).toContain('<loc>https://goosebumps.fm/editorial/my-editorial</loc>')
    })

    test('includes micro posts at /tweet/:slug', () => {
      const xml = buildSitemapXml(mockData, 'https://goosebumps.fm')

      expect(xml).toContain('<loc>https://goosebumps.fm/tweet/my-tweet</loc>')
    })

    test('null-type posts default to /editorial/:slug', () => {
      const data: SitemapData = {
        ...mockData,
        posts: [{ slug: 'unknown-type', updatedAt: new Date(), type: null }]
      }
      const xml = buildSitemapXml(data, 'https://goosebumps.fm')

      expect(xml).toContain('<loc>https://goosebumps.fm/editorial/unknown-type</loc>')
    })

    test('snapshot: full sitemap structure', () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-02-01T00:00:00Z'))

      try {
        // Use fixed dates for snapshot stability
        const fixedData: SitemapData = {
          mixes: [{ slug: 'test-mix', updatedAt: new Date('2024-01-15') }],
          shows: [{ slug: 'test-show', updatedAt: new Date('2024-01-10') }],
          releases: [{ slug: 'test-release', updatedAt: new Date('2024-01-05') }],
          labels: [{ slug: 'test-label', updatedAt: new Date('2024-01-01') }],
          profiles: [{ username: 'testuser', updatedAt: new Date('2024-01-20') }],
          posts: [
            {
              slug: 'test-post',
              updatedAt: new Date('2024-01-25'),
              type: 'post'
            },
            {
              slug: 'test-tweet',
              updatedAt: new Date('2024-01-26'),
              type: 'micro'
            }
          ]
        }

        const xml = buildSitemapXml(fixedData, 'https://goosebumps.fm')

        // Remove dynamic "now" date entries for snapshot stability
        // by extracting just the structure without the homepage/listing pages dates
        const contentUrls = xml
          .split('\n')
          .filter(
            (line) =>
              line.includes('/test-') ||
              line.includes('/testuser') ||
              line.includes('<loc>') === false
          )
          .join('\n')

        expect(contentUrls).toMatchSnapshot()
      } finally {
        vi.useRealTimers()
      }
    })
  })

  describe('buildSitemapIndexXml', () => {
    test('generates valid sitemap index structure', () => {
      const xml = buildSitemapIndexXml('https://goosebumps.fm')

      expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>')
      expect(xml).toContain('<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')
      expect(xml).toContain('<loc>https://goosebumps.fm/sitemap.xml</loc>')
      expect(xml).toContain('</sitemapindex>')
    })

    test('snapshot: sitemap index structure', () => {
      // This will have a dynamic date, so we just check structure
      const xml = buildSitemapIndexXml('https://goosebumps.fm')

      // Replace date with placeholder for snapshot stability
      const normalized = xml.replace(
        /<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/,
        '<lastmod>YYYY-MM-DD</lastmod>'
      )

      expect(normalized).toMatchInlineSnapshot(`
        "<?xml version="1.0" encoding="UTF-8"?>
        <sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
          <sitemap>
            <loc>https://goosebumps.fm/sitemap.xml</loc>
            <lastmod>YYYY-MM-DD</lastmod>
          </sitemap>
        </sitemapindex>"
      `)
    })
  })

  describe('empty data handling', () => {
    test('handles empty data gracefully', () => {
      const emptyData: SitemapData = {
        mixes: [],
        shows: [],
        releases: [],
        labels: [],
        profiles: [],
        posts: []
      }

      const xml = buildSitemapXml(emptyData, 'https://goosebumps.fm')

      // Should still have homepage and static pages
      expect(xml).toContain('<loc>https://goosebumps.fm</loc>')
      expect(xml).toContain('<loc>https://goosebumps.fm/mixes</loc>')
      expect(xml).toContain('</urlset>')
    })
  })
})
