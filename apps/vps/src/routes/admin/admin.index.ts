import { createRouter } from '@/lib/create-app'
import * as handlers from './admin.handlers'
import * as routes from './admin.routes'

const router = createRouter()
  .openapi(routes.getAdminOverview, handlers.getAdminOverview)
  .openapi(routes.simulateFrontendError, handlers.simulateFrontendError)
  .openapi(routes.getNewsletterSubscribers, handlers.getNewsletterSubscribers)

export default router
