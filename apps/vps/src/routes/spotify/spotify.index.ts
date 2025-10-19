import { createRouter } from '@/lib/create-app'

import * as handlers from './spotify.handlers'
import * as routes from './spotify.routes'

const router = createRouter()
  .openapi(routes.getTrack, handlers.getTrack)
  .openapi(routes.getAlbum, handlers.getAlbum)
  .openapi(routes.getPlaylist, handlers.getPlaylist)
  .openapi(routes.searchAlbums, handlers.searchAlbums)

export default router
