import { createRouter } from '@/lib/create-app'
import * as handlers from './favorites.handlers'
import * as routes from './favorites.routes'

const router = createRouter()
  .openapi(routes.addFavorite, handlers.addFavorite)
  .openapi(routes.removeFavorite, handlers.removeFavorite)
  .openapi(routes.getFavorites, handlers.getFavorites)

export default router
