import { createRouter } from '@/lib/create-app'

import * as handlers from './email.handlers'
import * as routes from './email.routes'

const router = createRouter()
  .openapi(routes.sendMixNotification, handlers.sendMixNotification)
  .openapi(routes.getEmailLogs, handlers.getEmailLogs)

export default router
