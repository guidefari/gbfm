import { Hono } from 'hono'
import { shareSlug } from './handlers/catch-all'
import { shareLabel } from './handlers/label'
import { shareMix } from './handlers/mix'
import { sharePost } from './handlers/post'
import { shareProfile } from './handlers/profile'
import { shareRelease } from './handlers/release'
import { shareShow } from './handlers/show'
import { shareTrack } from './handlers/track'
import { robotsTxt } from './seo/robots'
import { sitemapXml } from './seo/sitemap'

// Share routes - mounted at /s
const shareRouter = new Hono()

// Specific content type routes
shareRouter.get('/mix/:slug', shareMix)
shareRouter.get('/track/:slug', shareTrack)
shareRouter.get('/show/:slug', shareShow)
shareRouter.get('/profile/:username', shareProfile)
shareRouter.get('/release/:slug', shareRelease)
shareRouter.get('/label/:slug', shareLabel)
shareRouter.get('/post/:slug', sharePost)
shareRouter.get('/dispatch/:slug', sharePost)
shareRouter.get('/ping/:slug', sharePost)

// Catch-all route for profiles and shows (resolves slug)
shareRouter.get('/:slug', shareSlug)

// SEO routes - mounted at root
const seoRouter = new Hono()
seoRouter.get('/robots.txt', robotsTxt)
seoRouter.get('/sitemap.xml', sitemapXml)

export { seoRouter, shareRouter }
