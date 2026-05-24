import { createRouter } from '@/lib/create-app'
import { strictRateLimiter } from '@/middlewares/rate-limiter'
import * as handlers from './newsletter.handlers'
import * as routes from './newsletter.routes'

const router = createRouter()

router.use('*', strictRateLimiter())

router
  .openapi(routes.subscribe, handlers.subscribe)
  .openapi(routes.unsubscribe, handlers.unsubscribe)
  .openapi(routes.requestUnsubscribe, handlers.requestUnsubscribe)

export default router
