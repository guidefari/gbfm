import { createRouter } from "@/lib/create-app";
import * as handlers from "./mix.handlers";
import * as routes from "./mix.routes";

const router = createRouter()
  .openapi(routes.create, handlers.createMix)
  .openapi(routes.processUpload, handlers.processUpload);

export default router;
