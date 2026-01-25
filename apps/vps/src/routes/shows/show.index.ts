import { createRouter } from '@/lib/create-app'

import * as handlers from './show.handlers'
import * as routes from './show.routes'

const router = createRouter()
  .openapi(routes.getAllShows, handlers.getAllShows)
  .openapi(routes.getShowBySlug, handlers.getShowBySlug)
  .openapi(routes.createShow, handlers.createShow)
  .openapi(routes.updateShowBySlug, handlers.updateShowBySlug)
  .openapi(routes.deleteShowBySlug, handlers.deleteShowBySlug)
  .openapi(routes.getShowEpisodes, handlers.getShowEpisodes)
  .openapi(routes.subscribeToShow, handlers.subscribeToShow)
  .openapi(routes.unsubscribeFromShow, handlers.unsubscribeFromShow)

export default router
