import { createRouter } from "@/lib/create-app";

import * as handlers from "./auth.handlers";
import * as routes from "./auth.routes";

const router = createRouter()
  .openapi(routes.signup, handlers.signup)
  .openapi(routes.signin, handlers.signin)
  .openapi(routes.forgotPassword, handlers.forgotPassword)
  .openapi(routes.resetPassword, handlers.resetPassword)
  .openapi(routes.refreshToken, handlers.refreshToken);

export default router;