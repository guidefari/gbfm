import { Hono } from 'hono'
import * as handlers from './share.handlers'

const router = new Hono()

// Share endpoint for mixes - returns HTML with OG tags and redirects to the actual page
router.get('/mix/:slug', handlers.shareMix)

export default router
