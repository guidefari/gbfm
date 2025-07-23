import { createRouter } from "@/lib/create-app";

import * as handlers from "./content.handlers";
import * as routes from "./content.routes";

const router = createRouter()
  .openapi(routes.createPost, handlers.createPost)
  .openapi(routes.getPostsByTag, handlers.getPostsByTag)
  .openapi(routes.getMixes, handlers.getMixes)
  .openapi(routes.seedMixes, handlers.seedMixes);

export default router;